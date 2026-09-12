import { LocationError } from "@/modules/locations/domain/location-errors";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

/**
 * T8 fase 2 — borrar un local.
 *
 * Tres reglas que evitan dejar el negocio sin dónde despachar o perder historia:
 *  - **no se puede borrar el último local activo** (el checkout no tendría a dónde mandar el
 *    pedido y el cliente no podría pedir);
 *  - **no se puede dejar la lista vacía**, ni siquiera borrando uno apagado;
 *  - **no se puede borrar un local con pedidos**: la base lo impide con una FK `Restrict`, y acá
 *    se comprueba antes para devolver el motivo en vez de un 500.
 *
 * Un local apagado sin pedidos sí se borra, pero solo si queda otro activo.
 */
type DeleteLocationDependencies = {
  repository: LocationRepository;
  orderRepository: OrderRepository;
};

export async function deleteLocation(
  id: string,
  { repository, orderRepository }: DeleteLocationDependencies,
): Promise<{ data: { id: string }; meta: { updatedAt: string } }> {
  const current = await repository.findLocationById(id);
  if (!current) {
    throw new LocationError(404, "NOT_FOUND", "Location not found");
  }

  const others = (await repository.listLocations()).filter((location) => location.id !== id);

  if (others.length === 0) {
    throw new LocationError(409, "CONFLICT", "Cannot delete the only location", {
      id: "El negocio necesita al menos un local",
    });
  }

  if (current.isActive && others.every((location) => !location.isActive)) {
    throw new LocationError(409, "CONFLICT", "Cannot delete the last active location", {
      id: "Este es el último local activo: apagalo desde otro local o creá uno nuevo antes",
    });
  }

  const orders = await orderRepository.listOrders({ locationId: id });
  if (orders.length > 0) {
    throw new LocationError(409, "CONFLICT", "Location has orders", {
      id: `Este local tiene ${orders.length === 1 ? "un pedido" : `${orders.length} pedidos`}: apagalo si no querés ofrecerlo, pero no se puede borrar`,
    });
  }

  await repository.deleteLocation(id);

  return { data: { id }, meta: { updatedAt: new Date().toISOString() } };
}
