import { publish } from "@/infrastructure/events/event-bus";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { isValidStatusTransition } from "@/modules/orders/domain/order-workflows";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

export async function updateOrderStatus(
  id: string,
  input: {
    status: string;
    note?: string | null;
  },
  { repository }: { repository: OrderRepository },
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

  const updated = await repository.updateOrderStatus(id, input.status, normalizedNote);

  await publish("OrderStatusChanged", { orderId: id, status: input.status });

  return {
    data: updated,
    meta: { note: normalizedNote ?? undefined },
  };
}
