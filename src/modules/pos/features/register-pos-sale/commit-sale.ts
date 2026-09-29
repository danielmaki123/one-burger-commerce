import type { OrderRecord, PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import { calculateOrderChange, validatePaidWithAmount } from "@/modules/orders/domain/payment-change";
import type { CreateOrderRequest } from "@/modules/orders/features/create-order/create-order";
import type { PaymentSnapshot } from "@/modules/payments/domain/payment-snapshot";
import type { PaymentMethodConfigRecord } from "@/modules/payments/domain/payment-method-availability";
import type { MoneyContext } from "@/modules/money/domain/money-context";
import { roundCurrency } from "@/shared/lib/order-totals";

import { PosError } from "../../domain/pos-errors";
import { buildSalePaymentSnapshots } from "../../domain/pos-sale";
import type {
  PosSaleTransactionScope,
  RegisterPosSaleInput,
  RegisterPosSaleResult,
} from "./register-pos-sale";

/**
 * TASK-AUD-004 — lo que la venta del mostrador **escribe**, en un solo lugar.
 *
 * Está separado de `registerPosSale` —que decide, valida y cotiza— para que se vea de un vistazo qué entra
 * en la transacción: lo de acá se guarda junto, o no se guarda nada. Nada de este archivo abre la
 * transacción: la recibe por el alcance (`PosSaleTransactionScope`), que arma el adaptador.
 */

type CommitSaleInput = {
  input: RegisterPosSaleInput;
  /** El cupón, ya normalizado y cotizado: la cotización previa es la misma que vio el cajero. */
  couponCode: string | null;
  paidInBusinessCurrency: number;
  openShift: { id: string } | null;
  scope: PosSaleTransactionScope;
  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`, `D-024`) — **el contexto monetario vigente**.
   *
   * Entra como dato, no como dos escalares (`businessCurrencyCode` + `usdExchangeRate`): con el contexto,
   * `money` sigue siendo el dueño de la moneda base y de la tasa, y el POS puede cobrar en cualquier moneda
   * que el negocio tenga aceptada con tasa vigente.
   */
  money: MoneyContext;
  /**
   * `A-85`/`A-86` — **los medios que esta sucursal ofrece**, ya resueltos contra el catálogo persistido. Sin
   * ellos el snapshot sale del enum histórico del cobro; con ellos, un medio apagado o fuera de la sucursal
   * rechaza la venta antes de escribir nada.
   */
  paymentMethods?: readonly PaymentMethodConfigRecord[];
  /**
   * Los snapshots ya construidos, **opcionales**: el caso de uso los arma para poder rechazar una moneda sin
   * tasa antes de abrir la transacción. Si no llegan, `commitSale` los construye igual —con `money`— antes de
   * escribir, así que es imposible que un cobro del POS quede sin snapshot aunque el llamador se olvide.
   */
  snapshots?: PaymentSnapshot[];
};

export async function commitSale({
  input,
  couponCode,
  paidInBusinessCurrency,
  openShift,
  scope,
  money,
  paymentMethods = [],
  snapshots: providedSnapshots,
}: CommitSaleInput): Promise<RegisterPosSaleResult> {
  /**
   * `A-81` — **el snapshot se construye antes del primer `INSERT`**, sí o sí.
   *
   * Es la guarda que cierra el hallazgo desde el lado de la escritura: el camino productivo podía crear un
   * `Payment` con los cinco campos de `D-020` en `null` porque nada obligaba a construirlos. Acá se
   * construyen —los que vinieron del caso de uso o unos nuevos con el mismo contexto— y una moneda sin tasa
   * vigente corta la venta antes de que exista el pedido.
   */
  const snapshots =
    providedSnapshots ??
    buildSalePaymentSnapshots({
      payments: input.payments,
      money,
      locationId: input.draft.locationId,
      catalog: paymentMethods,
    });
  /**
   * TASK-AUD-005 — **primero el turno**, después todo lo demás.
   *
   * El bloqueo hace dos cosas: espera a un cierre que esté en curso y devuelve el estado **de verdad** (no
   * la foto que se leyó antes de abrir la transacción). Si el turno ya se cerró, la venta se rechaza acá y
   * no se escribe nada: antes, un cobro que entraba en esa ventana quedaba firmado con un turno cerrado,
   * fuera de todo arqueo.
   */
  if (openShift) {
    const locked = await scope.lockShift(openShift.id);

    if (!locked || locked.status !== "open") {
      throw new PosError(
        409,
        "CONFLICT",
        "La caja se cerró mientras cobrabas: abrí la caja y volvé a cobrar la venta.",
        { shift: "La caja de este local se cerró." },
      );
    }
  }

  const { order, reused } = await scope.createPosOrder(
    saleOrderRequest(input, couponCode, paidInBusinessCurrency),
  );

  /**
   * El total real del alta puede no ser el del borrador (el menú cambió entre que el cajero cargó el
   * catálogo y cobró). Cortar acá **no deja el pedido**: la transacción se deshace entera (TASK-AUD-004).
   * Antes esta salida dejaba el pedido guardado **sin ningún cobro** y el cajero volvía a cobrar.
   *
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`) — **en un reintento esta comprobación no corre**:
   * el pedido ya existe y ya se validó cuando se cobró; lo que el cajero declaró ahora es el mismo intento, no
   * un cobro nuevo. Comparar el monto de hoy contra el total real haría fallar un reintento legítimo si la
   * tasa con la que se comparó cambió, que es exactamente «reconstruir el pasado con la configuración de hoy».
   */
  if (!reused) {
    const orderProblem = validatePaidWithAmount({
      paidWithAmount: paidInBusinessCurrency,
      total: order.total,
      paymentMethod: "cash",
    });
    if (orderProblem) {
      throw new PosError(
        409,
        "CONFLICT",
        `El total del pedido ${order.orderNumber} es ${order.total} y el cobro no alcanza: revisá el menú y volvé a cobrar.`,
        { payments: `Faltan cobrar ${order.total - paidInBusinessCurrency}` },
      );
    }
  }

  // El vuelto **solo existe en un cobro único en efectivo**: si la venta se partió entre medios, la
  // parte de efectivo es exacta (lo que sobrara se habría cobrado de menos por el otro medio), así que
  // anunciar cambio sería mentirle al cajero y al arqueo. En un pago mixto queda en 0.
  const changeBelongsToCash = input.payments.length === 1 && input.payments[0].method === "cash";
  const change =
    changeBelongsToCash && !reused
      ? calculateOrderChange({ paidWithAmount: paidInBusinessCurrency, total: order.total })
      : 0;

  /**
   * Tarea 11 del brief (2026-09-17) — el pedido ya existía (misma clave de intento): **no se cobra otra
   * vez**. Registrar los cobros de nuevo dejaba el mismo pedido cobrado dos veces y el arqueo del turno
   * contaba esa plata de más. La respuesta se arma con lo que quedó guardado en el primer intento, que es
   * lo que el cajero ya tiene en la mano.
   *
   * TASK-AUD-004 — el reintento **no** puede devolver una venta a medio cobrar: si el intento anterior se
   * cortó entre dos cobros, el pedido ya no existe (la transacción se deshizo), así que esta rama solo se
   * alcanza con una venta que quedó completa.
   */
  if (reused) {
    return reuseRecordedSale({ scope, order });
  }

  const payments = await recordSalePayments({
    scope,
    orderId: order.id,
    input,
    snapshots,
    change,
    changeBelongsToCash,
    shiftId: openShift?.id ?? null,
  });

  return {
    order,
    payments,
    paidInBusinessCurrency,
    change,
    reused: false,
  };
}

/**
 * Bloque 4 del roadmap del POS (Fase 2) — el medio del pedido a partir del cobro real.
 *
 * `Order.paymentMethod` (y el enum `PaymentMethod`) declara solo `cash | card`: es la declaración del
 * cliente en el checkout. Un cobro del mostrador puede ser transferencia u otro, así que acá se
 * traduce: lo que no es tarjeta se declara efectivo, que es como se comporta para el local. El detalle
 * real (con su referencia y su monto) queda en `Payment`.
 */
function toDeclaredPaymentMethod(method: PaymentMethodType | undefined): "cash" | "card" {
  return method === "card" ? "card" : "cash";
}

/**
 * El pedido que se le pide al alta, tal como lo arma el mostrador. Es **datos**, no escritura: no toca la
 * base y por eso se puede leer aparte de la transacción.
 */
function saleOrderRequest(
  input: RegisterPosSaleInput,
  couponCode: string | null,
  paidInBusinessCurrency: number,
): CreateOrderRequest {
  return {
    type: "pickup",
    // `TASK-ORDERS-KITCHEN-RUNTIME-002` — el canal de origen lo declara la puerta: esta es la venta
    // del **mostrador**, así que el pedido entra como `pos`. Es un dato, no una deducción: la cocina lo
    // dibuja como etiqueta y no se infiere de ningún otro campo.
    source: "pos",
    customerName: input.customer.name,
    customerWhatsapp: input.customer.whatsapp,
    customerEmail: input.customer.email ?? null,
    // Punto 4: el alta es la única puerta de los datos del cliente, así que los fiscales también van por ahí
    // (los normaliza y los guarda en el `Customer`).
    customerTaxId: input.customer.taxId ?? null,
    customerLegalName: input.customer.legalName ?? null,
    items: input.draft.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      // Los modificadores que el cajero eligió. El alta los valida y los cotiza
      // (`basePrice + Σ priceDelta`): antes viajaba `[]` y un producto con un grupo obligatorio no se
      // podía vender desde el mostrador (422 del alta).
      modifierOptionIds: line.modifierOptionIds ?? [],
      notes: line.notes ?? null,
    })),
    // La forma de pago del pedido es la del primer cobro **traducida a lo que el pedido declara**
    // (`cash` o `card`): el detalle real —transferencia, mixto, cada monto— está en los cobros. Una
    // transferencia o un pago mixto declaran `cash`, que es como se comporta el cobro para el local
    // (la plata no pasó por una terminal).
    paymentMethod: toDeclaredPaymentMethod(input.payments[0]?.method),
    /**
     * TASK-305: lo que el cliente puso sobre el mostrador, en moneda del negocio. Se guarda porque el
     * arqueo necesita saber cuánto salió de vuelto: sin eso, un día con vueltos parecería que falta
     * plata.
     *
     * Tarea 10 del brief (2026-09-17): **solo viaja cuando el pedido declara efectivo**. Con tarjeta la
     * terminal cobra el total exacto y no hay «con cuánto paga»; mandarlo hacía que `createOrder` —que
     * valida ese campo contra la forma declarada— rechazara **toda** venta con tarjeta (400). La
     * cobertura del cobro se sigue midiendo igual: las dos comprobaciones de `registerPosSale` usan la
     * semántica del efectivo, que es «el monto tiene que alcanzar el total».
     */
    paidWithAmount:
      toDeclaredPaymentMethod(input.payments[0]?.method) === "cash" ? paidInBusinessCurrency : null,
    // "Lo antes posible": el servidor completa la hora con su reloj y la preparación configurada.
    pickupTime: null,
    pickupScheduled: false,
    tipOptIn: false,
    // Tarea 9.6: el cupón se aplica en el alta (valida, calcula y consume el uso). Tarea 9.7: el descuento
    // manual viaja como forma y motivo, y el alta lo compone con el cupón.
    couponCode,
    manualDiscount: input.manualDiscount ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  };
}

/**
 * Los cobros de la venta, adentro del alcance transaccional: es lo que hace que un fallo en el segundo no
 * deje el pedido cobrado a medias (TASK-AUD-004).
 */
async function recordSalePayments({
  scope,
  orderId,
  input,
  snapshots,
  change,
  changeBelongsToCash,
  shiftId,
}: {
  scope: PosSaleTransactionScope;
  orderId: string;
  input: RegisterPosSaleInput;
  snapshots: PaymentSnapshot[];
  change: number | null;
  changeBelongsToCash: boolean;
  shiftId: string | null;
}): Promise<PaymentRecord[]> {
  const payments: PaymentRecord[] = [];

  for (const [index, payment] of input.payments.entries()) {
    const snapshot = snapshots[index];

    payments.push(
      await scope.paymentRepository.createPayment({
        orderId,
        method: payment.method,
        amount: payment.amount,
        currency: payment.currency.trim().toUpperCase(),
        changeAmount: changeBelongsToCash ? (change ?? 0) : 0,
        // Bloque 4: la referencia externa (voucher o id de transferencia) viaja con el cobro.
        ...(payment.reference ? { reference: payment.reference } : {}),
        // Fase 6: el cobro queda firmado con el turno donde entró (si hay caja abierta).
        shiftId,
        /**
         * `A-81`/`D-020` — **el snapshot**, que es lo que hace que el hecho se explique solo. El monto y la
         * moneda viajan igual que antes (son columnas propias del cobro); los otros tres campos son los que
         * faltaban: contra qué moneda base se convirtió, con qué tasa y cuánto valía.
         */
        baseCurrencyCode: snapshot.baseCurrencyCode,
        exchangeRate: snapshot.exchangeRate,
        baseAmount: snapshot.baseAmount,
        /**
         * `D-017` — el tipo canónico del momento. Cuando el cobro se hizo con un medio del catálogo, el
         * snapshot trae además **con qué medio** y **contra qué entidad** se liquidó: renombrar o apagar el
         * medio no reescribe el hecho.
         */
        methodKind: snapshot.methodKind,
        ...(snapshot.paymentMethodId ? { paymentMethodId: snapshot.paymentMethodId } : {}),
        ...(snapshot.entityId !== undefined ? { entityId: snapshot.entityId } : {}),
      }),
    );
  }

  return payments;
}

/**
 * La respuesta de un reintento: lo que ya quedó guardado, sin volver a cobrar (tarea 11).
 *
 * `A-81`/`D-020` — el total se arma con el **equivalente persistido** de cada cobro (`baseAmount`), nunca
 * volviendo a convertir con la tasa vigente: un reintento no puede cambiar el número que el cajero ya vio, y
 * reconstruir el pasado con la configuración de hoy es el bug de dinero que `D-020` prohíbe.
 */
async function reuseRecordedSale({
  scope,
  order,
}: {
  scope: PosSaleTransactionScope;
  order: OrderRecord;
}): Promise<RegisterPosSaleResult> {
  const recorded = await scope.paymentRepository.listPaymentsByOrder(order.id);

  return {
    order,
    payments: recorded,
    paidInBusinessCurrency: sumRecordedBaseAmounts(recorded),
    change: recorded.length === 1 && recorded[0].method === "cash" ? recorded[0].changeAmount : 0,
    reused: true,
  };
}

/**
 * La suma de los cobros **ya congelados**. Un cobro legacy sin snapshot no se reinterpreta: queda fuera y el
 * llamador lo ve en la diferencia (es la decisión de `D-020`, no un número inventado).
 */
function sumRecordedBaseAmounts(payments: readonly PaymentRecord[]): number {
  const total = payments.reduce((sum, payment) => sum + (payment.baseAmount ?? 0), 0);

  return roundCurrency(total);
}
