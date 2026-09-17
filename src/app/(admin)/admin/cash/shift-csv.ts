import { buildCsvFileName, buildCsvText, csvAmount, CSV_SEPARATOR } from "@/shared/lib/csv";

import { formatShiftDateTime } from "./cash-shift-helpers";

/**
 * Bloque 11.3 del roadmap del POS (Fase 2) — el export de cierres a CSV.
 *
 * Función pura: el navegador solo baja el archivo (y eso se prueba en el E2E). El formato —separador `;`,
 * números crudos, celdas vacías para lo que no se contó y escapado— vive en `@/shared/lib/csv`, que es lo
 * que comparte con la conciliación de tarjeta y transferencia (tarea 10): dos copias del escapado serían
 * dos archivos que se abren distinto. Acá queda solo qué columnas tiene el export de cierres.
 */

export { CSV_SEPARATOR };

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

export function buildShiftCsv(
  shifts: ShiftCsvRow[],
  options: { timezone: string; locale: string; locationName: string },
): string {
  const format = { timezone: options.timezone, locale: options.locale };

  return buildCsvText(
    HEADERS,
    shifts.map((shift) => {
      // Un turno abierto no se contó: las celdas de cierre van **vacías**, no en 0.
      const counted = shift.closingAmount === null;

      return [
        options.locationName,
        formatShiftDateTime(shift.openedAt, format),
        formatShiftDateTime(shift.closedAt, format),
        csvAmount(shift.openingAmount),
        counted ? "" : csvAmount(shift.closingAmount),
        counted ? "" : csvAmount(shift.expectedAmount),
        counted ? "" : csvAmount(shift.difference),
        csvAmount(shift.cashSalesAmount),
        csvAmount(shift.cashMovementsAmount),
        csvAmount(shift.refundsAmount),
        shift.notes ?? "",
      ];
    }),
  );
}

/** `cierres-camino-de-oriente-2026-09-17.csv`: sin espacios ni dos puntos (el sistema los odia). */
export function buildShiftCsvFileName(locationName: string, date: string): string {
  return buildCsvFileName("cierres", locationName, date);
}
