import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

import { ShiftError } from "@/modules/orders/domain/shift-errors";

/**
 * Bloque 1.10 del roadmap del POS (Fase 2) — reabrir un turno cerrado.
 *
 * Cerrar dos veces no pisa el arqueo (a propósito: dos terminales no pueden firmar dos conteos del
 * mismo turno), pero eso dejaba sin salida el caso real —se cerró con el conteo mal y hay que volver
 * a contar—. La reapertura es explícita y **firmada**: quién, cuándo y por qué. El motivo es
 * obligatorio porque una reapertura sin razón escrita no se puede auditar.
 */
export async function reopenShift(
  input: { shiftId: string; userId: string; reason: string; strict?: boolean },
  { shiftRepository }: { shiftRepository: ShiftRepository },
) {
  const shiftId = input.shiftId?.trim();
  if (!shiftId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", { shiftId: "Requerido" });
  }

  const reason = input.reason?.trim();
  if (!reason) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Escribí por qué reabrís la caja.", {
      reason: "El motivo es obligatorio para reabrir una caja.",
    });
  }

  const userId = input.userId?.trim();
  if (!userId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", { userId: "Requerido" });
  }

  const shift = await shiftRepository.findShiftById(shiftId);
  // Un turno abierto no se reabre (ya lo está) y uno inexistente tampoco. El camino HTTP quiere el
  // error con nombre (`strict`); el caso de uso suelto se queda con `null`, igual que el cierre.
  if (!shift || shift.status !== "closed") {
    if (input.strict) {
      throw new ShiftError(409, "CONFLICT", "Ese turno no está cerrado.");
    }

    return { data: null };
  }

  const reopened = await shiftRepository.reopenShift(shiftId, {
    userId,
    reason,
  });

  return { data: reopened };
}
