import {
  formatSheetAmount,
  formatSheetMovement,
  formatSheetMoment,
  SHIFT_SIGNATURE_LINE,
  type ShiftSheetOptions,
} from "@/shared/lib/shift-sheet-format";

/**
 * Tarea 7 del brief (2026-09-17) — el papel de la **lectura parcial** (1.12) y del **traspaso de caja** (1.13).
 *
 * Nombres de Fase 1a del rediseño de Caja (2026-09-19): lo que el brief viejo llamaba «corte X» se llama
 * **lectura parcial** en la UI y en el papel. Los identificadores (`ShiftXSheetInput`, `buildShiftXSheet`)
 * y la ruta de la API no se renombran en esta fase: son superficie de contrato y cambiarlos no aporta.
 *
 * Es el mismo documento en dos usos: el cajero lo saca a mitad del turno para ver cómo va la caja, y lo
 * firma cuando le pasa la caja a otro. Por eso el título cambia según haya alguien que reciba, pero el
 * número es el mismo: el esperado **de ahora**, con la misma cuenta que el cierre, y con la aclaración de
 * que **no** cierra la caja —un papel sin eso se puede confundir con un cierre y el turno quedaría abierto
 * con un documento que dice lo contrario—.
 *
 * Función pura: los montos llegan ya resueltos y acá solo se decide cómo se dicen.
 */

export type ShiftXSheetInput = {
  shiftId: string;
  locationName: string;
  /** Cuándo se abrió la caja. */
  openedAt: string;
  /** Cuándo se sacó este corte. */
  generatedAt: string;
  openingAmount: number;
  /** El esperado del momento: fondo + efectivo + movimientos − devoluciones. */
  expectedAmount: number;
  expectedByCurrency: Record<string, number>;
  cashSalesAmount: number;
  cashMovementsAmount: number;
  refundsAmount: number;
  /** Quién entrega (el cajero de la sesión). `null` = no se pudo resolver: se imprime «—». */
  handedByName: string | null;
  /** Quién recibe. Con nombre, el corte es un **traspaso** y se firma de los dos lados. */
  receivedByName: string | null;
};

/** El detalle por moneda: una moneda distinta se imprime con **su** código. */
function buildCurrencyLines(input: ShiftXSheetInput, options: ShiftSheetOptions): string[] {
  const rows = Object.entries(input.expectedByCurrency ?? {});

  if (rows.length === 0) return ["Sin detalle por moneda."];

  return rows.map(
    ([code, expected]) =>
      `${code.toUpperCase()}  esperado ${formatSheetAmount(expected, code, options)}`,
  );
}

/** Las firmas: la del traspaso son dos (el que entrega y el que recibe). */
function buildSignatureLines(input: ShiftXSheetInput): string[] {
  const lines = [`Entrega: ${input.handedByName?.trim() || "—"}`, SHIFT_SIGNATURE_LINE];

  if (input.receivedByName?.trim()) {
    lines.push(`Recibe: ${input.receivedByName.trim()}`, SHIFT_SIGNATURE_LINE);
  }

  return lines;
}

/** El corte completo, línea por línea, listo para imprimir. */
export function buildShiftXSheet(input: ShiftXSheetInput, options: ShiftSheetOptions): string[] {
  const isHandover = Boolean(input.receivedByName?.trim());

  return [
    options.businessName.toUpperCase(),
    isHandover ? "TRASPASO DE CAJA (LECTURA PARCIAL)" : "LECTURA PARCIAL (SIN CERRAR)",
    `Sucursal: ${input.locationName}`,
    `Turno: ${input.shiftId}`,
    `Abierto: ${formatSheetMoment(input.openedAt, options)}`,
    `Corte: ${formatSheetMoment(input.generatedAt, options)}`,
    "",
    "EFECTIVO ESPERADO EN LA CAJA",
    `Fondo: ${formatSheetAmount(input.openingAmount, options.currencyCode, options)}`,
    `Ventas en efectivo: ${formatSheetAmount(input.cashSalesAmount, options.currencyCode, options)}`,
    `Movimientos: ${formatSheetMovement(input.cashMovementsAmount, options)}`,
    `Devoluciones aprobadas en efectivo: ${formatSheetAmount(
      input.refundsAmount,
      options.currencyCode,
      options,
    )}`,
    `Esperado: ${formatSheetAmount(input.expectedAmount, options.currencyCode, options)}`,
    "",
    "POR MONEDA",
    ...buildCurrencyLines(input, options),
    "",
    "Este corte NO cierra la caja: el turno sigue abierto.",
    "",
    ...buildSignatureLines(input),
  ];
}
