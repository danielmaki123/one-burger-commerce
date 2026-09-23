import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

/**
 * El turno abierto de un local, o `null` si la caja está cerrada.
 *
 * Devuelve `null` en vez de un error a propósito: "no hay caja abierta" es un estado normal de la
 * operación (el local abrió y todavía nadie abrió la caja), no un fallo.
 *
 * Fase 6 del rediseño de Caja (2026-09-23) — con `terminalId` es la caja **de esa terminal**; sin él, la
 * caja **sin** terminal: una sucursal sin terminales cargadas sigue teniendo una sola caja abierta.
 */
export async function getCurrentShift(
  input: { locationId: string; terminalId?: string | null },
  { shiftRepository }: { shiftRepository: ShiftRepository },
) {
  const locationId = input.locationId?.trim();
  if (!locationId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", {
      locationId: "Requerido",
    });
  }

  const shift = await shiftRepository.findOpenShiftByLocation(
    locationId,
    input.terminalId?.trim() ? input.terminalId.trim() : null,
  );

  return { data: shift };
}
