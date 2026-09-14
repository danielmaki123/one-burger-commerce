import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

/**
 * El turno abierto de un local, o `null` si la caja está cerrada.
 *
 * Devuelve `null` en vez de un error a propósito: "no hay caja abierta" es un estado normal de la
 * operación (el local abrió y todavía nadie abrió la caja), no un fallo.
 */
export async function getCurrentShift(
  input: { locationId: string },
  { shiftRepository }: { shiftRepository: ShiftRepository },
) {
  const locationId = input.locationId?.trim();
  if (!locationId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", {
      locationId: "Requerido",
    });
  }

  const shift = await shiftRepository.findOpenShiftByLocation(locationId);

  return { data: shift };
}
