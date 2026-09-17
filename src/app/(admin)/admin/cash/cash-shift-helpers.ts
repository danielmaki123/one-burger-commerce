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
 * Un turno cerrado sin conteo cargado no se puede auditar: se dice, no se inventa un 0. El arqueo
 * ciego guarda el esperado y deja la diferencia sin calcular hasta que alguien cuente.
 */
export function isShiftPendingCount(shift: Pick<ShiftRecord, "closingAmount">): boolean {
  return shift.closingAmount === null;
}

/** Resumen de una pantalla de historial: cuántos turnos y cuántos quedaron sin contar. */
export function summarizeShifts(shifts: Pick<ShiftRecord, "closingAmount" | "difference">[]) {
  const pendingCount = shifts.filter(isShiftPendingCount).length;

  return {
    total: shifts.length,
    pendingCount,
    countedCount: shifts.length - pendingCount,
    differenceTotal: shifts.reduce((sum, shift) => sum + (shift.difference ?? 0), 0),
  };
}

/**
 * Fecha y hora del turno **en la zona del negocio**, no en la del navegador.
 *
 * El día de caja es el del negocio (misma regla que el tablero de «Hoy»): un cierre de las 23:40 en
 * Managua no puede mostrarse como del día siguiente porque el cajero abrió la pantalla en Madrid.
 */
export function formatShiftDateTime(
  iso: string | null,
  options: { timezone: string; locale: string },
): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** La fecha de caja (sin hora) para agrupar y titular el historial. */
export function formatShiftDate(
  iso: string | null,
  options: { timezone: string; locale: string },
): string {
  if (!iso) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timezone,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

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

