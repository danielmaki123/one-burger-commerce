import { publish } from "@/infrastructure/events/event-bus";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { isValidStatusTransition } from "@/modules/orders/domain/order-workflows";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";

export async function updateOrderStatus(
  id: string,
  input: {
    status: string;
    note?: string | null;
    /** B5 — quién lo cambió, para el historial (id del usuario del panel). */
    changedByUserId?: string | null;
  },
  {
    repository,
    paymentRepository,
    refundRepository,
  }: {
    repository: OrderRepository;
    /**
     * Bloque 3.5 del POS (Fase 2) — cobros del pedido, para dejar la devolución pendiente cuando se
     * cancela algo ya cobrado. Opcional: sin él el cambio de estado sigue funcionando igual.
     */
    paymentRepository?: Pick<PaymentRepository, "listPaymentsByOrder">;
    refundRepository?: Pick<RefundRepository, "create" | "listByPayment">;
  },
) {
  const normalizedNote = input.note?.trim() ?? null;
  const order = await repository.findOrderById(id);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  if (input.status === "cancelled" && !normalizedNote) {
    throw new OrderError(422, "VALIDATION_ERROR", "Cancellation note is required", {
      note: "Required when status is cancelled",
    });
  }

  if (!isValidStatusTransition(order.type, order.status, input.status as never)) {
    throw new OrderError(409, "CONFLICT", `Invalid status transition from ${order.status} to ${input.status}`);
  }

  const updated = await repository.updateOrderStatus(
    id,
    input.status,
    normalizedNote,
    input.changedByUserId ?? null,
  );

  /*
   * Bloque 3.5 — cancelar un pedido **cobrado** deja la devolución pendiente y avisa.
   *
   * Es el agujero de plata que quedaba (A-15 del backlog de UI): el cobro seguía contando en el arqueo
   * y nadie sabía que había que devolver la plata. La devolución queda **pendiente** a propósito: la
   * plata todavía está en el cajón hasta que alguien la devuelva y la apruebe, así que el esperado del
   * turno no cambia con la cancelación.
   */
  if (input.status === "cancelled" && paymentRepository && refundRepository) {
    const payments = await paymentRepository.listPaymentsByOrder(id);

    for (const payment of payments) {
      const already = (await refundRepository.listByPayment(payment.id)).filter(
        (refund) => refund.status !== "rejected",
      );
      const refunded = already.reduce((sum, refund) => sum + refund.amount, 0);
      const pending = payment.amount - refunded;
      if (pending <= 0) continue;

      await refundRepository.create({
        paymentId: payment.id,
        orderId: id,
        shiftId: null,
        kind: "full",
        method: payment.method,
        amount: pending,
        currency: (payment.currency ?? "NIO").toUpperCase(),
        reason: `Pedido ${order.orderNumber} cancelado: ${normalizedNote}`,
        status: "pending",
        requestedByUserId: input.changedByUserId ?? null,
        approvedByUserId: null,
        approvedAt: null,
      });
    }

    await publish("OrderRefundRequested", { orderId: id, payments: payments.length });
  }

  await publish("OrderStatusChanged", { orderId: id, status: input.status });

  return {
    data: updated,
    meta: { note: normalizedNote ?? undefined },
  };
}

