import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

/**
 * Bloque 1.3 del roadmap del POS (Fase 2) — los turnos de un local, para el historial de cierres.
 *
 * La lectura es **tal cual se guardó**: el arqueo de un turno cerrado no se recalcula (el
 * `expectedAmount` quedó congelado al cerrar y los conteos se guardan billete por billete). Recomputar
 * acá usaría la tasa de cambio de hoy y mostraría un número que nunca existió.
 *
 * El caso de uso no filtra por estado: devuelve todos los turnos del local —abiertos y cerrados— con
 * su cuenta, y la decisión de qué mostrar es de la pantalla.
 */
export async function listLocationShifts(
  input: { locationId: string },
  { shiftRepository }: { shiftRepository: ShiftRepository },
) {
  const locationId = input.locationId?.trim();
  if (!locationId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", {
      locationId: "Requerido",
    });
  }

  const shifts = await shiftRepository.listShifts(locationId);
  const openCount = shifts.filter((shift) => shift.status === "open").length;

  return {
    data: shifts,
    meta: {
      locationId,
      total: shifts.length,
      openCount,
      closedCount: shifts.length - openCount,
    },
  };
}
