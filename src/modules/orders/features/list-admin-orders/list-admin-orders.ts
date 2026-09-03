import type { OrderRepository } from "@/modules/orders/ports/order-repository";

export async function listAdminOrders(
  filter: {
    type?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  { repository }: { repository: OrderRepository },
) {
  const orders = await repository.listOrders(filter);
  return {
    data: orders,
    meta: { count: orders.length },
  };
}
