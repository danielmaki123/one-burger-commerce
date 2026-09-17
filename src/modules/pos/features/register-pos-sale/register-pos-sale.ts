import type { OrderRecord, PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import {
  calculateOrderChange,
  validatePaidWithAmount,
} from "@/modules/orders/domain/payment-change";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { CreateOrderRequest } from "@/modules/orders/features/create-order/create-order";

import { assertPosDraftReady, posDraftTotals, type PosDraft } from "../../domain/pos-draft";
import { PosError } from "../../domain/pos-errors";
import { paymentsTotalInBusinessCurrency, type PosSalePaymentInput } from "../../domain/pos-sale";

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
  customer: { name: string; whatsapp: string; email?: string | null };
  payments: PosSalePaymentInput[];
  /** Clave de la operación: un reintento del mismo cobro no crea dos ventas (TASK-101). */
  idempotencyKey?: string | null;
};

export type RegisterPosSaleDependencies = {
  /** El alta real, ya cableada por la composición (el POS no conoce el grafo del módulo `orders`). */
  createPosOrder: (input: CreateOrderRequest) => Promise<OrderRecord>;
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
};

export type RegisterPosSaleResult = {
  order: OrderRecord;
  payments: PaymentRecord[];
  /** Lo que entró, convertido a la moneda del negocio. */
  paidInBusinessCurrency: number;
  change: number | null;
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

  const draftTotal = posDraftTotals(input.draft).total;
  const draftProblem = validatePaidWithAmount({
    paidWithAmount: paidInBusinessCurrency,
    total: draftTotal,
    paymentMethod: "cash",
  });
  if (draftProblem) {
    throw new PosError(422, "VALIDATION_ERROR", draftProblem, { payments: draftProblem });
  }

  const order = await deps.createPosOrder({
    type: "pickup",
    customerName: input.customer.name,
    customerWhatsapp: input.customer.whatsapp,
    customerEmail: input.customer.email ?? null,
    items: input.draft.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      modifierOptionIds: [],
      notes: line.notes ?? null,
    })),
    // La forma de pago del pedido es la del primer cobro **traducida a lo que el pedido declara**
    // (`cash` o `card`): el detalle real —transferencia, mixto, cada monto— está en los cobros. Una
    // transferencia o un pago mixto declaran `cash`, que es como se comporta el cobro para el local
    // (la plata no pasó por una terminal).
    paymentMethod: toDeclaredPaymentMethod(input.payments[0]?.method),
    // TASK-305: lo que el cliente puso sobre el mostrador, en moneda del negocio. Se guarda porque el
    // arqueo necesita saber cuánto salió de vuelto: sin eso, un día con vueltos parecería que falta
    // plata. `createOrder` lo vuelve a validar contra el total que calcula él.
    paidWithAmount: paidInBusinessCurrency,
    // "Lo antes posible": el servidor completa la hora con su reloj y la preparación configurada.
    pickupTime: null,
    pickupScheduled: false,
    tipOptIn: false,
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
  };
}
