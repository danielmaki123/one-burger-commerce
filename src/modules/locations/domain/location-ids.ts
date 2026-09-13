/**
 * Lectura de una lista de sucursales que llega de afuera (formulario del admin, API, sesión).
 *
 * Sin vacíos, sin repetidos y en el orden en que el owner las eligió: el orden con el que se
 * muestran los filtros y las listas es una decisión suya, no del `Set` que se use para deduplicar.
 */
export function normalizeLocationIds(ids?: readonly (string | null | undefined)[] | null): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of ids ?? []) {
    const value = id?.trim();
    if (!value || seen.has(value)) continue;

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

/** Mensaje único para el error de asignación (lo usan el alta y la edición de usuarios). */
export const UNKNOWN_LOCATION_MESSAGE = "Alguna de las sucursales elegidas no existe";

/**
 * Las sucursales elegidas que ya no existen. Se comprueba **antes** de guardar: un id inventado
 * dejaría al usuario acotado a una sucursal fantasma (no vería ningún pedido).
 */
export function findUnknownLocationIds(
  assignedIds: readonly string[],
  existingIds: readonly string[],
): string[] {
  const existing = new Set(existingIds);

  return assignedIds.filter((id) => !existing.has(id));
}
