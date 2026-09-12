import type {
  LocationRecord,
  LocationResolution,
} from "@/modules/locations/domain/location.types";

/**
 * Qué local atiende un pedido (T8).
 *
 * Dos reglas y nada más:
 *  - **sin local elegido se usa el primario** (el primero activo por orden), así el
 *    negocio de un solo local sigue funcionando sin que nadie elija nada;
 *  - **un local pedido que no sirve se rechaza**, no se cae al primario. Caer al
 *    primario sería mandar la comida al local equivocado sin avisar.
 *
 * El orden es determinista a propósito (orden manual y, si empatan, el nombre): dos
 * locales con el mismo `sortOrder` no pueden alternar según cómo los devuelva la base.
 */

export type { LocationRecord };

function byDisplayOrder(a: LocationRecord, b: LocationRecord): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, "es");
}

/** El local por defecto: el primero activo. `null` si no hay ninguno activo. */
export function pickDefaultLocation(locations: LocationRecord[]): LocationRecord | null {
  const active = locations.filter((location) => location.isActive).sort(byDisplayOrder);

  return active[0] ?? null;
}

export function resolveLocation({
  requestedLocationId,
  locations,
}: {
  requestedLocationId: string | null | undefined;
  locations: LocationRecord[];
}): LocationResolution {
  const requested = requestedLocationId?.trim();

  if (!requested) {
    const fallback = pickDefaultLocation(locations);
    return fallback ? { ok: true, location: fallback } : { ok: false, reason: "none-active" };
  }

  const found = locations.find((location) => location.id === requested);
  if (!found) return { ok: false, reason: "not-found" };
  if (!found.isActive) return { ok: false, reason: "inactive" };

  return { ok: true, location: found };
}
