import { z } from "zod";

import { PosError } from "@/modules/pos/domain/pos-errors";

/**
 * Tarea 10 del brief (2026-09-17) — la forma de la consulta de **conciliación** (11.1/11.2).
 *
 * La fecha se valida **antes** de tocar la base: `businessDayRange` con una fecha inválida deja el rango
 * abierto, y un export abierto sería el historial entero en vez del día que el owner pidió. Sin fecha, la
 * ruta usa el día del negocio.
 */
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha tiene que ser YYYY-MM-DD");

/** `null` cuando no se pidió fecha (la ruta resuelve el día del negocio). */
export function parseReconciliationDate(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;

  const parsed = dateSchema.safeParse(value);

  if (!parsed.success) {
    throw new PosError(422, "VALIDATION_ERROR", "Revisá la fecha de la conciliación.", {
      date: parsed.error.issues[0]?.message ?? "Fecha inválida.",
    });
  }

  return parsed.data;
}
