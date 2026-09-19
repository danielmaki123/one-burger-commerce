import type { OrderRecord, PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import {
  calculateOrderChange,
  validatePaidWithAmount,
} from "@/modules/orders/domain/payment-change";
import {
  composeSaleDiscount,
  manualDiscountAmount,
} from "@/modules/orders/domain/sale-discount";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { CreateOrderRequest } from "@/modules/orders/features/create-order/create-order";

import { assertPosDraftReady, posDraftTotals, type PosDraft } from "../../domain/pos-draft";
import { PosError } from "../../domain/pos-errors";
import {
  paymentsTotalInBusinessCurrency,
  recordedPaymentsTotalInBusinessCurrency,
  type PosSalePaymentInput,
} from "../../domain/pos-sale";

/**
 * TASK-303b — la venta de mostrador, en **un solo paso**.
 *
 * Decisión del owner: en el mostrador se pide y se paga de una vez. El caso de uso hace las dos
 * cosas en ese orden porque el alta (`createOrder`) es la **única puerta** que resuelve precios,
 * empaque y totales: si el POS calculara el total por su cuenta, habría dos verdades sobre la plata.
 *
 * El cobro se registra después del alta, con la moneda en la que entró (el arqueo necesita saber si
 * en el cajón hay córdobas o dólares) y el cambio se **deriva** (no se guarda), igual que en el
 * checkout.
 *
 * Antes de crear nada se compara lo que el cliente puso contra el total del borrador —la misma
 * fórmula del servidor— para no dejar un pedido creado por un cobro que no alcanza. Después del
 * alta se vuelve a comparar contra el total real: si el menú cambió entre que el cajero cargó el
 * catálogo y cobró, el error dice el número de pedido y la diferencia, en vez de registrar un cobro
 * que no cubre la venta.
 */

export type RegisterPosSaleInput = {
  draft: PosDraft;
  customer: {
    name: string;
    whatsapp: string;
    email?: string | null;
    /** Punto 4 del roadmap (2026-09-18) — factura con RUC: los dos datos, ya validados por la ruta. */
    taxId?: string | null;
    legalName?: string | null;
  };
  payments: PosSalePaymentInput[];
  /** Clave de la operación: un reintento del mismo cobro no crea dos ventas (TASK-101). */
  idempotencyKey?: string | null;
  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — el código de promo que el cliente trajo, tal como lo escribió
   * el cajero. El alta (`createOrder`) es la que lo valida, calcula el descuento y consume el uso.
   */
  couponCode?: string | null;
  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** autorizado (permiso aparte en la ruta,
   * `canDiscountPosSale`). Llega como forma y motivo; el monto lo calcula el servidor.
   */
  manualDiscount?: { kind: "percentage" | "amount"; value: number; reason: string } | null;
};

export type RegisterPosSaleDependencies = {
  /**
   * El alta real, ya cableada por la composición (el POS no conoce el grafo del módulo `orders`).
   *
   * Devuelve además si el alta **reusó** un pedido ya creado con la misma clave de intento: en ese caso
   * los cobros no se registran otra vez (tarea 11).
   */
  createPosOrder: (input: CreateOrderRequest) => Promise<{ order: OrderRecord; reused: boolean }>;
  paymentRepository: PaymentRepository;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
  /**
   * Bloque 9.2 del roadmap del POS (Fase 2) — la caja abierta del local, si hay.
   *
   * Un cobro con la caja cerrada **no entra a ningún arqueo**: se registra el `Payment` y el turno
   * que lo explica no existe. Antes se permitía (con un aviso en pantalla) y la plata quedaba fuera
   * del control; ahora es un 409 con el motivo, y el mostrador lo dice antes de cobrar.
   */
  findOpenShift?: (locationId: string) => Promise<{ id: string } | null>;
  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — la **misma** cotización que vio el cajero, para comparar el
   * cobro contra el total con descuento.
   *
   * El descuento autoritativo sigue siendo el del alta (que puede rechazar el cupón); esta cotización existe
   * para no rechazar una venta que el cliente ya pagó bien: sin ella, la comprobación previa comparaba
   * contra el total **sin** cupón y una venta con descuento «no alcanzaba».
   */
  quoteCoupon?: (input: {
    couponCode: string;
    lines: { productId: string; quantity: number }[];
  }) => Promise<{ discount: number }>;
};

export type RegisterPosSaleResult = {
  order: OrderRecord;
  payments: PaymentRecord[];
  /** Lo que entró, convertido a la moneda del negocio. */
  paidInBusinessCurrency: number;
  change: number | null;
  /**
   * Tarea 11 del brief (2026-09-17) — `true` cuando el alta **reconoció** el intento: el pedido ya existía
   * (misma clave) y esta llamada no cobró nada. La pantalla lo dice para que nadie cobre dos veces.
   */
  reused: boolean;
};

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

export async function registerPosSale(
  input: RegisterPosSaleInput,
  deps: RegisterPosSaleDependencies,
): Promise<RegisterPosSaleResult> {
  assertPosDraftReady(input.draft);

  // Bloque 9.2 — sin caja abierta no se cobra: el cobro no tendría arqueo que lo explique.
  if (deps.findOpenShift) {
    const openShift = await deps.findOpenShift(input.draft.locationId);
    if (!openShift) {
      throw new PosError(409, "CONFLICT", "Abrí la caja antes de cobrar.", {
        shift: "No hay una caja abierta en este local.",
      });
    }
  }

  const paidInBusinessCurrency = paymentsTotalInBusinessCurrency({
    payments: input.payments,
    businessCurrencyCode: deps.businessCurrencyCode,
    usdExchangeRate: deps.usdExchangeRate,
  });

  /**
   * Tarea 9.6 — el cupón mueve el total que se le pide al cliente. Se cotiza **antes** de comparar: el
   * cajero ya le mostró ese número al cliente, así que la comprobación previa tiene que usar el mismo.
   */
  const couponCode = input.couponCode?.trim() ? input.couponCode.trim() : null;
  const couponDiscount =
    couponCode && deps.quoteCoupon
      ? (
          await deps.quoteCoupon({
            couponCode,
            lines: input.draft.lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          })
        ).discount
      : 0;

  /**
   * Tarea 9.7 — el descuento manual se calcula sobre el subtotal del borrador (lo que el cajero le está
   * cobrando al cliente) y se compone con el del cupón: entre los dos nunca pasan de la venta.
   */
  const manualAmount = input.manualDiscount
    ? manualDiscountAmount({
        discount: input.manualDiscount,
        subtotal: posDraftTotals(input.draft).subtotal,
      })
    : { ok: true as const, amount: 0 };

  if (!manualAmount.ok) {
    const message =
      manualAmount.reason === "missing-reason"
        ? "Escribí por qué se hace el descuento."
        : "El descuento tiene que ser un monto mayor que cero o un porcentaje de hasta 100 %.";

    throw new PosError(422, "VALIDATION_ERROR", message, { discount: message });
  }

  const expectedTotal = posDraftTotals(
    input.draft,
    composeSaleDiscount({
      couponDiscount,
      manualDiscount: manualAmount.amount,
      subtotal: posDraftTotals(input.draft).subtotal,
    }),
  ).total;

  const draftProblem = validatePaidWithAmount({
    paidWithAmount: paidInBusinessCurrency,
    total: expectedTotal,
    paymentMethod: "cash",
  });
  if (draftProblem) {
    throw new PosError(422, "VALIDATION_ERROR", draftProblem, { payments: draftProblem });
  }

  const { order, reused } = await deps.createPosOrder({
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
     * cobertura del cobro se sigue midiendo igual: los dos `validatePaidWithAmount` de arriba usan la
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
  });

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

  const payments: PaymentRecord[] = [];
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
   */
  if (reused) {
    const recorded = await deps.paymentRepository.listPaymentsByOrder(order.id);

    return {
      order,
      payments: recorded,
      paidInBusinessCurrency: recordedPaymentsTotalInBusinessCurrency({
        payments: recorded,
        businessCurrencyCode: deps.businessCurrencyCode,
        usdExchangeRate: deps.usdExchangeRate,
      }),
      change:
        recorded.length === 1 && recorded[0].method === "cash" ? recorded[0].changeAmount : 0,
      reused: true,
    };
  }

  for (const payment of input.payments) {
    payments.push(
      await deps.paymentRepository.createPayment({
        orderId: order.id,
        method: payment.method,
        amount: payment.amount,
        currency: payment.currency.trim().toUpperCase(),
        changeAmount: changeBelongsToCash ? (change ?? 0) : 0,
        // Bloque 4: la referencia externa (voucher o id de transferencia) viaja con el cobro.
        ...(payment.reference ? { reference: payment.reference } : {}),
      }),
    );
  }

  return {
    order,
    payments,
    paidInBusinessCurrency,
    change,
    reused: false,
  };
}
