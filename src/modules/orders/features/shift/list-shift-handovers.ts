import type { ShiftHandoverRepository } from "@/modules/orders/ports/shift-handover-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

/**
 * Tarea 7 del brief (2026-09-17) — **leer los traspasos** de un turno (1.13).
 *
 * Los pide la pantalla de caja (los del turno abierto) y el detalle de un cierre viejo (los de ese turno,
 * para auditar quién tenía la plata). Sin caja abierta devuelve una lista vacía en vez de un error: «acá
 * todavía no hubo traspasos» es un estado normal de la operación.
 */
export async function listShiftHandovers(
  input: { locationId: string; shiftId?: string | null },
  {
    shiftRepository,
    handoverRepository,
  }: { shiftRepository: ShiftRepository; handoverRepository: ShiftHandoverRepository },
) {
  const shiftId = input.shiftId?.trim() || (await shiftRepository.findOpenShiftByLocation(input.locationId))?.id;

  if (!shiftId) return { data: [] };

  return { data: await handoverRepository.listByShift(shiftId) };
}
