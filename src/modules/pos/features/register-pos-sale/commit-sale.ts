import type { OrderRecord, PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import { calculateOrderChange, validatePaidWithAmount } from "@/modules/orders/domain/payment-change";
import type { CreateOrderRequest } from "@/modules/orders/features/create-order/create-order";

import { PosError } from "../../domain/pos-errors";
import { recordedPaymentsTotalInBusinessCurrency } from "../../domain/pos-sale";
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
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
};

export async function commitSale({
  input,
  couponCode,
  paidInBusinessCurrency,
  openShift,
  scope,
  businessCurrencyCode,
  usdExchangeRate,
}: CommitSaleInput): Promise<RegisterPosSaleResult> {
  const { order, reused } = await scope.createPosOrder(
    saleOrderRequest(input, couponCode, paidInBusinessCurrency),
  );

  /**
   * El total real del alta puede no ser el del borrador (el menú cambió entre que el cajero cargó el
   * catálogo y cobró). Cortar acá **no deja el pedido**: la transacción se deshace entera (TASK-AUD-004).
   * Antes esta salida dejaba el pedido guardado **sin ningún cobro** y el cajero volvía a cobrar.
   */
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

  // El vuelto **solo existe en un cobro único en efectivo**: si la venta se partió entre medios, la
  // parte de efectivo es exacta (lo que sobrara se habría cobrado de menos por el otro medio), así que
  // anunciar cambio sería mentirle al cajero y al arqueo. En un pago mixto queda en 0.
  const changeBelongsToCash = input.payments.length === 1 && input.payments[0].method === "cash";
  const change = changeBelongsToCash
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
    return reuseRecordedSale({ scope, order, businessCurrencyCode, usdExchangeRate });
  }

  const payments = await recordSalePayments({
    scope,
    orderId: order.id,
    input,
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
  change,
  changeBelongsToCash,
  shiftId,
}: {
  scope: PosSaleTransactionScope;
  orderId: string;
  input: RegisterPosSaleInput;
  change: number | null;
  changeBelongsToCash: boolean;
  shiftId: string | null;
}): Promise<PaymentRecord[]> {
  const payments: PaymentRecord[] = [];

  for (const payment of input.payments) {
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
      }),
    );
  }

  return payments;
}

/** La respuesta de un reintento: lo que ya quedó guardado, sin volver a cobrar (tarea 11). */
async function reuseRecordedSale({
  scope,
  order,
  businessCurrencyCode,
  usdExchangeRate,
}: {
  scope: PosSaleTransactionScope;
  order: OrderRecord;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): Promise<RegisterPosSaleResult> {
  const recorded = await scope.paymentRepository.listPaymentsByOrder(order.id);

  return {
    order,
    payments: recorded,
    paidInBusinessCurrency: recordedPaymentsTotalInBusinessCurrency({
      payments: recorded,
      businessCurrencyCode,
      usdExchangeRate,
    }),
    change: recorded.length === 1 && recorded[0].method === "cash" ? recorded[0].changeAmount : 0,
    reused: true,
  };
}
