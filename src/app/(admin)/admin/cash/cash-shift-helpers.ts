import type { ShiftRecord } from "@/modules/orders/domain/order.types";

/**
 * Presentación del historial de caja (Bloque 1 del roadmap del POS, Fase 2).
 *
 * Son funciones puras a propósito: el arqueo de un turno cerrado es un documento contable, así que la
 * decisión de qué número se muestra y con qué tono se prueba sin navegador (el E2E solo comprueba que
 * llegue a la pantalla).
 */

export type CashDifferenceTone = "cuadra" | "falta" | "sobra" | "sin-contar";

/**
 * El tono de la diferencia. Un turno **sin contar** (`closingAmount === null`, cierre ciego) no tiene
 * diferencia: mostrarlo como "cuadra" sería afirmar que la caja está bien sin haberla contado.
 */
export function getCashDifferenceTone(shift: {
  closingAmount: number | null;
  difference: number | null;
}): CashDifferenceTone {
  if (shift.closingAmount === null || shift.difference === null) return "sin-contar";
  if (shift.difference === 0) return "cuadra";
  return shift.difference < 0 ? "falta" : "sobra";
}

export const CASH_DIFFERENCE_LABEL: Record<CashDifferenceTone, string> = {
  cuadra: "Cuadra",
  falta: "Falta",
  sobra: "Sobra",
  "sin-contar": "Sin contar",
};

/** El texto de la diferencia con su signo, o el motivo por el que no hay número. */
export function formatCashDifference(
  shift: Pick<ShiftRecord, "closingAmount" | "difference">,
  formatAmount: (value: number) => string,
): string {
  const tone = getCashDifferenceTone(shift);
  if (tone === "sin-contar") return "Sin contar";

  const amount = Math.abs(shift.difference ?? 0);
  if (tone === "cuadra") return formatAmount(0);
  return `${tone === "falta" ? "-" : "+"}${formatAmount(amount)}`;
}

/**
 * Un monto con su signo, para los totales de un día o de una sucursal (Bloques 11.5/11.6): `+C$25.00`,
 * `-C$100.00` y `C$0.00` cuando cuadra —un `+C$0.00` se lee como una sobra que no existe—.
 */
export function formatSignedAmount(
  value: number,
  formatAmount: (value: number) => string,
): string {
  if (value === 0) return formatAmount(0);

  return `${value > 0 ? "+" : "-"}${formatAmount(Math.abs(value))}`;
}

/**
 * Fecha y hora del turno **en la zona del negocio**, no en la del navegador.
 *
 * La implementación vive en `src/shared/lib/shift-datetime.ts` desde el Bloque 13.3: la hoja de cierre
 * la imprime en el papel y el export CSV la usa, así que pantalla, papel y export dicen la misma hora.
 *
 * Fase 2 del rediseño de Caja (2026-09-22) — acá vivían también `summarizeShifts`, `isShiftPendingCount` y
 * `formatShiftDate`: los usaban la lista embebida de Caja y el día consolidado, que salieron de la pantalla
 * en la Fase 1b. Se eliminaron con su test (código muerto), como se acordó al cerrar esa fase.
 */
export { formatShiftDateTime } from "@/shared/lib/shift-datetime";

/** Un conteo guardado del turno, tal como sale del adaptador. */
export type StoredCashCount = {
  kind: "opening" | "closing";
  currency: string;
  denomination: number;
  quantity: number;
};

/**
 * Lo que se contó de **una** moneda en un lado del turno (apertura o cierre), sin convertir.
 *
 * `null` cuando ese lado no tiene conteo: un cierre ciego o un turno viejo sin billetes cargados.
 * Devolver 0 ahí sería afirmar que se contó y había nada.
 */
export function countsTotalOf(
  counts: StoredCashCount[],
  currency: string,
  kind: "opening" | "closing",
): number | null {
  const target = currency.trim().toUpperCase();
  const rows = counts.filter(
    (count) => count.kind === kind && count.currency.trim().toUpperCase() === target,
  );

  if (rows.length === 0) return null;

  return rows.reduce((sum, count) => sum + count.denomination * count.quantity, 0);
}

