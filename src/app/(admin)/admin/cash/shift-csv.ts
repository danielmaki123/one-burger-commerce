import { formatShiftDateTime } from "./cash-shift-helpers";

/**
 * Bloque 11.3 del roadmap del POS (Fase 2) — el export de cierres a CSV.
 *
 * Función pura: el navegador solo baja el archivo (y eso se prueba en el E2E). Las decisiones del
 * formato están acá y son por una razón concreta:
 *
 * - **Separador `;`**: el formato de moneda del negocio escribe `1.234,00` (coma decimal), así que con
 *   una coma como separador el archivo se desarmaría en columnas al abrirlo en una planilla.
 * - **Números crudos** (`1500.00`, `-50.00`), sin símbolo de moneda: una planilla no entiende `C$` y
 *   ordenar como texto rompe cualquier suma.
 * - **Un turno abierto deja los montos de cierre vacíos**, no en 0: no se contó, y un 0 afirmaría que
 *   la caja estaba vacía.
 * - **Escapado**: un campo con el separador, comillas o salto de línea va entre comillas y sus comillas
 *   dobladas; si no, una nota parte la fila.
 */

export const CSV_SEPARATOR = ";";

export type ShiftCsvRow = {
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  cashSalesAmount?: number | null;
  cashMovementsAmount?: number | null;
  refundsAmount?: number | null;
  notes: string | null;
};

const HEADERS = [
  "Local",
  "Apertura",
  "Cierre",
  "Fondo",
  "Contado",
  "Esperado",
  "Diferencia",
  "Efectivo del turno",
  "Movimientos",
  "Devoluciones",
  "Notas",
];

/** Escapa un campo: entre comillas si trae separador, comillas o salto, y dobla las comillas. */
function escapeField(value: string): string {
  if (
    value.includes(CSV_SEPARATOR) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function amount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";

  // Sin símbolo y con punto decimal: es lo que una planilla suma.
  return value.toFixed(2);
}

export function buildShiftCsv(
  shifts: ShiftCsvRow[],
  options: { timezone: string; locale: string; locationName: string },
): string {
  const rows = [HEADERS.join(CSV_SEPARATOR)];

  for (const shift of shifts) {
    const counted = shift.closingAmount === null;
    const format = { timezone: options.timezone, locale: options.locale };

    rows.push(
      [
        options.locationName,
        formatShiftDateTime(shift.openedAt, format),
        formatShiftDateTime(shift.closedAt, format),
        amount(shift.openingAmount),
        // Un turno abierto no se contó: vacío, no 0.
        counted ? "" : amount(shift.closingAmount),
        counted ? "" : amount(shift.expectedAmount),
        counted ? "" : amount(shift.difference),
        amount(shift.cashSalesAmount),
        amount(shift.cashMovementsAmount),
        amount(shift.refundsAmount),
        shift.notes ?? "",
      ]
        .map((field) => escapeField(String(field)))
        .join(CSV_SEPARATOR),
    );
  }

  // CRLF: es lo que Excel y las planillas de escritorio esperan.
  return rows.join("\r\n");
}

/** `cierres-camino-de-oriente-2026-09-17.csv`: sin espacios ni dos puntos (el sistema los odia). */
export function buildShiftCsvFileName(locationName: string, date: string): string {
  const slug = locationName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `cierres-${slug}-${date}.csv`;
}
