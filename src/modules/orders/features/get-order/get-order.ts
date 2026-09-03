import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

export async function getOrder(
  id: string,
  { repository }: { repository: OrderRepository },
) {
  const order = await repository.findOrderById(id);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }
  return { data: order };
}
