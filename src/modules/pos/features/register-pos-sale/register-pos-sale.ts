import type { OrderRecord, PaymentRecord } from "@/modules/orders/domain/order.types";
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
};

export type RegisterPosSaleResult = {
  order: OrderRecord;
  payments: PaymentRecord[];
  /** Lo que entró, convertido a la moneda del negocio. */
  paidInBusinessCurrency: number;
  change: number | null;
};

export async function registerPosSale(
  input: RegisterPosSaleInput,
  deps: RegisterPosSaleDependencies,
): Promise<RegisterPosSaleResult> {
  assertPosDraftReady(input.draft);

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
    // La forma de pago del pedido es la del primer cobro: el detalle real está en los cobros.
    paymentMethod: input.payments[0]?.method ?? "cash",
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
  for (const payment of input.payments) {
    payments.push(
      await deps.paymentRepository.createPayment({
        orderId: order.id,
        method: payment.method,
        amount: payment.amount,
        currency: payment.currency.trim().toUpperCase(),
      }),
    );
  }

  return {
    order,
    payments,
    paidInBusinessCurrency,
    change: calculateOrderChange({ paidWithAmount: paidInBusinessCurrency, total: order.total }),
  };
}
