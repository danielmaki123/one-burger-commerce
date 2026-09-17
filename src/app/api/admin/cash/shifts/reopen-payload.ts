import { z } from "zod";

import { ShiftError } from "@/modules/orders/domain/shift-errors";

/**
 * Bloque 1.10 del roadmap del POS (Fase 2) — el payload y las guardas de la reapertura.
 *
 * Van acá y no en la ruta porque el repo tiene un tope de 50 líneas por `route.ts`: el handler
 * orquesta y esto se prueba sin levantar una request.
 */

const reopenSchema = z.object({
  reason: z.string().trim().min(1, "Escribí por qué reabrís la caja.").max(300),
});

export function parseReopenShiftPayload(body: unknown): { reason: string } {
  const parsed = reopenSchema.safeParse(body);

  if (!parsed.success) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Escribí por qué reabrís la caja.", {
      reason: parsed.error.issues[0]?.message ?? "El motivo es obligatorio para reabrir una caja.",
    });
  }

  return { reason: parsed.data.reason };
}

/**
 * El turno tiene que ser de una sucursal dentro del alcance de quien reabre.
 *
 * Se responde 404 y no 403 a propósito: un id de otra sucursal no debería confirmar que existe.
 */
export function assertShiftInScope(
  shift: { locationId: string } | null,
  locationIds: readonly string[],
): void {
  if (!shift || !locationIds.includes(shift.locationId)) {
    throw new ShiftError(404, "NOT_FOUND", "No encontramos ese turno de caja.");
  }
}
