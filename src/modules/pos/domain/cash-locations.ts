import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { OrderLocationScope } from "@/modules/orders/domain/order-visibility";

/**
 * Bloque 1.3 del roadmap del POS (Fase 2) — qué locales puede mirar quien abre la caja del día.
 *
 * Es **más ancho** que `pickPosLocations` a propósito: el historial de cierres incluye turnos de
 * locales que hoy están apagados o con el mostrador apagado, y ese dinero se contó igual. Si se
 * filtrara por `isActive`/`posEnabled`, cerrar el POS en una sucursal borraría su historial de la
 * pantalla.
 *
 * Lo que sí se respeta es el alcance por sucursal: un manager asignado no ve las cajas de las
 * sucursales que no atiende.
 */
export function listCashLocations(
  locations: readonly LocationRecord[],
  scope: OrderLocationScope,
): LocationRecord[] {
  return locations.filter((location) => {
    if (scope.kind === "restricted") return scope.locationIds.includes(location.id);
    return true;
  });
}

/** El local pedido si está dentro del alcance; si no, el primero disponible; si no hay, `null`. */
export function resolveCashLocationId(
  locations: readonly LocationRecord[],
  requested?: string | null,
): string | null {
  const wanted = requested?.trim();
  if (wanted && locations.some((location) => location.id === wanted)) return wanted;

  return locations[0]?.id ?? null;
}
