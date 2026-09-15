import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { OrderLocationScope } from "@/modules/orders/domain/order-visibility";

/**
 * TASK-308 — qué locales ofrece el mostrador.
 *
 * Dos condiciones propias del POS y el alcance que ya existe: el local tiene que estar **encendido**
 * (un local apagado no recibe pedidos ni cobra) y tener el **punto de venta prendido**.
 *
 * El alcance se aplica acá y no en la pantalla: prender el POS en una sucursal que este cajero no
 * atiende no puede habilitarle nada, ni mostrarle una caja que no es suya.
 */
export function pickPosLocations(
  locations: readonly LocationRecord[],
  scope: OrderLocationScope,
): LocationRecord[] {
  return locations.filter((location) => {
    if (!location.isActive || !location.posEnabled) return false;
    if (scope.kind === "restricted") return scope.locationIds.includes(location.id);
    return true;
  });
}
