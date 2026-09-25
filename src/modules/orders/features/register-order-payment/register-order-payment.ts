import type { OrderRecord, PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — **registrar el cobro de un pedido que ya existe**.
 *
 * Hasta acá el sistema solo sabía cobrar **creando** una venta de mostrador: un pedido del menú público (que
 * se paga al retirar y por eso no tiene ningún `Payment`) no podía cobrarse nunca, y sin cobros **no se
 * puede facturar** (`emit-invoice` corta con 409). Esto cierra ese hueco: se registra el cobro sobre el
 * pedido y recién ahí la factura se puede emitir.
 *
 * Tres guardas, que son las que evitan los errores caros del mostrador:
 *
 * 1. **Un pedido cancelado no se cobra** (no hay nada que entregar).
 * 2. **Un pedido ya cobrado no se cobra dos veces** (la plata entraría dos veces al arqueo).
 * 3. **Un cobro que pasa el total se rechaza**: cobrar de más es un error de tipeo, no una propina.
 *
 * El cobro se **atribuye al turno abierto** de la terminal desde la que se cobra (`Payment.shiftId`), así
 * entra al arqueo que corresponde; sin caja abierta se registra igual y sin turno —perder la venta sería
 * peor— y el cierre de ese día lo lee por ventana como cualquier cobro sin turno.
 */

export type RegisterOrderPaymentInput = {
  orderId: string;
  method: PaymentMethodType;
  /** Lo que se cobró (no lo que el cliente puso sobre el mostrador). */
  amount: number;
  currency: string;
  reference?: string | null;
  /** Fase 6 — la terminal del POS que cobra, para atribuir el cobro a **su** caja. */
  terminalId?: string | null;
};

export type RegisterOrderPaymentDependencies = {
  orderRepository: Pick<OrderRepository, "findOrderById">;
  paymentRepository: Pick<
    PaymentRepository,
    "listPaymentsByOrder" | "createPayment" | "getPaymentSummary"
  >;
  /** El turno abierto de esa terminal (o del local, sin terminal). */
  findOpenShift?: (
    locationId: string,
    terminalId?: string | null,
  ) => Promise<{ id: string } | null>;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
};

export async function registerOrderPayment(
  input: RegisterOrderPaymentInput,
  deps: RegisterOrderPaymentDependencies,
): Promise<{ data: PaymentRecord; order: OrderRecord }> {
  const orderId = input.orderId?.trim();
  if (!orderId) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", { orderId: "Requerido" });
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "Revisá el cobro.", {
      amount: "Tiene que ser mayor que cero.",
    });
  }

  const order = await deps.orderRepository.findOrderById(orderId);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Ese pedido no existe.", {
      order: "Ese pedido no existe.",
    });
  }

  if (order.status === "cancelled") {
    throw new OrderError(409, "CONFLICT", "Un pedido cancelado no se cobra.", {
      order: "Un pedido cancelado no se cobra.",
    });
  }

  const summary = await deps.paymentRepository.getPaymentSummary(order.id);
  const alreadyPaid = roundCurrency(summary.totalAmount);

  if (alreadyPaid >= order.total) {
    throw new OrderError(409, "CONFLICT", "Ese pedido ya está cobrado.", {
      order: "Ese pedido ya está cobrado.",
    });
  }

  const amount = roundCurrency(input.amount);

  if (roundCurrency(alreadyPaid + amount) > order.total) {
    throw new OrderError(
      409,
      "CONFLICT",
      `El cobro pasa el total del pedido (${(order.total - alreadyPaid).toFixed(2)} pendiente).`,
      { amount: "El cobro pasa el total del pedido: revisá el monto." },
    );
  }

  const openShift = deps.findOpenShift
    ? await deps.findOpenShift(order.locationId, input.terminalId ?? null)
    : null;

  const payment = await deps.paymentRepository.createPayment({
    orderId: order.id,
    method: input.method,
    amount,
    currency: input.currency.trim().toUpperCase(),
    // El vuelto no se registra acá: el mostrador carga lo que **cobró**, no lo que el cliente puso sobre
    // el mostrador (esa cuenta es de la venta del POS, que sí pide «con cuánto paga»).
    changeAmount: 0,
    ...(input.reference ? { reference: input.reference } : {}),
    shiftId: openShift?.id ?? null,
  });

  return { data: payment, order };
}
