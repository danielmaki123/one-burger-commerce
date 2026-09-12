import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";
import type { ListOrdersFilter, OrderRepository } from "@/modules/orders/ports/order-repository";

/** Pedido con el nombre del local al lado, que es lo que la pantalla muestra. */
export type AdminOrder = OrderRecord & { locationName: string | null };

export async function listAdminOrders(
  filter: ListOrdersFilter,
  { repository, locationRepository }: {
    repository: OrderRepository;
    locationRepository: LocationRepository;
  },
): Promise<{ data: AdminOrder[]; meta: { count: number } }> {
  const orders = await repository.listOrders(filter);

  // El nombre del local se resuelve una sola vez para toda la lista (T8). Un pedido de un
  // local borrado queda sin nombre en vez de romper la pantalla.
  const locations = await locationRepository.listLocations();
  const nameById = new Map(locations.map((location) => [location.id, location.name]));

  const data: AdminOrder[] = orders.map((order) => ({
    ...order,
    locationName: nameById.get(order.locationId) ?? null,
  }));

  return {
    data,
    meta: { count: data.length },
  };
}
