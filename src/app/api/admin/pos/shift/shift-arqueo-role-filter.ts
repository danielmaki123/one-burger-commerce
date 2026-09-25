/**
 * Hallazgo A-45 del backlog (`ops/audit-backlog.md`) — **el arqueo ciego tiene que ser una regla de
 * servidor, no un sello de pantalla**.
 *
 * Con `blindCount` prendido, la pantalla de Caja escondía el esperado y la diferencia (Fase 4), pero por
 * API el cajero los leía igual: `GET /api/admin/pos/shift/x` (el corte X) y el cierre devolvían
 * `expectedAmount`, `expectedByCurrency`, `difference` y el cuadre por banco a cualquiera que pueda operar
 * el POS. Contar a ciegas con el número a un `curl` de distancia no es contar a ciegas.
 *
 * Decisión del brief de cierre de Caja (2026-09-23): **quien cobra no ve el esperado**. El cajero recibe
 * solo su propio conteo; Manager y Owner siguen viendo todo, porque son quienes auditan la caja.
 */

/** Los campos que comparan lo contado contra lo esperado: sin ellos queda el conteo propio y nada más. */
const COMPARISON_FIELDS = new Set([
  "expectedAmount",
  "expectedByCurrency",
  "difference",
  "bankChargedByCurrency",
  "bankDifferenceByCurrency",
  "bankDifferenceAmount",
]);

/**
 * ¿Puede este rol leer el esperado y la diferencia? Sí para quien audita la caja (Manager y Owner), no
 * para el cajero. Un rol desconocido **no** se filtra: es preferible que el dueño vea un dato de más a que
 * una regla nueva deje a alguien sin su arqueo.
 */
export function canSeeArqueo(role: string): boolean {
  return role !== "cashier";
}

/**
 * Quita los campos de comparación de un arqueo (corte X o cierre) para quien no audita. Se aplica en la
 * **respuesta** de la ruta, no en el caso de uso: el traspaso de caja y el aviso al dueño siguen usando el
 * arqueo completo del lado del servidor.
 */
export function filterArqueoForRole<T>(payload: T, role: string): T {
  if (canSeeArqueo(role)) return payload;

  return stripComparisonFields(payload) as T;
}

function stripComparisonFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripComparisonFields);

  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !COMPARISON_FIELDS.has(key))
      .map(([key, entry]) => [key, stripComparisonFields(entry)]),
  );
}
