import type { PickupLocation } from "@/modules/locations/domain/location-rules";
import { describePickupLocation } from "@/modules/locations/domain/location-rules";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRecord } from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

/**
 * Pedido del admin con su punto de retiro al lado (T8 fase 7).
 *
 * Igual que `listAdminOrders`, el local se resuelve al leer: el pedido guarda el
 * `locationId`, nunca el nombre ni la dirección.
 */
export type AdminOrderDetail = OrderRecord & { pickupLocation: PickupLocation | null };

export async function getOrder(
  id: string,
  {
    repository,
    locationRepository,
  }: { repository: OrderRepository; locationRepository: LocationRepository },
): Promise<{ data: AdminOrderDetail }> {
  const order = await repository.findOrderById(id);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  // Un local borrado (o un id viejo) deja el pedido sin punto de retiro, no rompe el detalle.
  const location = await locationRepository.findLocationById(order.locationId);

  return { data: { ...order, pickupLocation: describePickupLocation(location) } };
}
