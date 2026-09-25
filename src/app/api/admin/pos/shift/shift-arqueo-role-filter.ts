/**
 * Hallazgo A-45 del backlog (`ops/audit-backlog.md`) + TASK-AUD-003 — **el arqueo ciego tiene que ser una
 * regla de servidor, y no puede ser derivable**.
 *
 * A-45 (2026-09-23) cerró la mitad: con `blindCount` prendido, el `cashier` dejó de recibir
 * `expectedAmount`, `expectedByCurrency` y la diferencia. Pero **AUD-003 encontró que la otra mitad seguía
 * abierta**: el arqueo viaja con sus sumandos, y el esperado es exactamente su suma
 *
 *     esperado = fondo + efectivo del turno + movimientos + devoluciones
 *
 * así que esconder el total y mandar las partes no escondía nada — alcanzaba una resta. Lo mismo con
 * `paymentMix`, que trae el efectivo del turno adentro. Y el **traspaso de caja** devolvía el arqueo
 * completo sin filtrar, con la misma puerta (la del mostrador).
 *
 * Decisión del owner (brief de cierre de Caja, 2026-09-23, sostenida en AUD-003): **quien cobra no ve el
 * esperado ni nada que lo determine**. Manager y Owner siguen viendo todo, porque son quienes auditan.
 *
 * El filtro es una **lista de lo que no viaja**, aplicada en profundidad y en la **respuesta** de la ruta
 * (no en el caso de uso): el traspaso y el aviso al dueño se firman con el arqueo completo del lado del
 * servidor. La misma verdad vive en la pantalla (`cash-partial-reading-modal.tsx`), que para el cajero no
 * dibuja estas filas: si el servidor no manda los sumandos, mostrar la fila sería un `NaN` — y peor, una
 * invitación a completar el número a mano.
 */

/**
 * Lo que **no** viaja a quien no audita: el total, la diferencia y **todo lo que la determina**.
 *
 * Si mañana el arqueo suma un campo nuevo que participe del cálculo, tiene que entrar acá y su test
 * (`shift-blind-count.test.ts`) lo pide: la lista es la frontera del arqueo ciego.
 */
const HIDDEN_FROM_BLIND_COUNT = new Set([
  // El total y la diferencia.
  "expectedAmount",
  "expectedByCurrency",
  "difference",
  // Los sumandos: sin ellos no hay resta que hacer.
  "cashSalesAmount",
  "cashMovementsAmount",
  "refundsAmount",
  "refundsByCurrency",
  // El desglose por medio de pago trae el efectivo del turno adentro.
  "paymentMix",
  "tipsAmount",
  "nonCashByCurrency",
  // El cuadre por banco se calcula contra lo cobrado fuera del cajón.
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
 * Quita del arqueo (corte X, cierre o traspaso) todo lo que permite leer o reconstruir el esperado para
 * quien no audita la caja.
 */
export function filterArqueoForRole<T>(payload: T, role: string): T {
  if (canSeeArqueo(role)) return payload;

  return stripBlindFields(payload) as T;
}

function stripBlindFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripBlindFields);

  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !HIDDEN_FROM_BLIND_COUNT.has(key))
      .map(([key, entry]) => [key, stripBlindFields(entry)]),
  );
}
