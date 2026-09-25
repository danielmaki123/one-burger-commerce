import type { CloseShiftScope } from "@/modules/orders/features/shift/close-shift";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

/**
 * TASK-AUD-005 — el doble de la **unidad de trabajo del cierre**.
 *
 * Corre el trabajo con los mismos dobles y sin transacción: un doble en memoria no puede fallar como falla
 * la base ni bloquear una fila, así que la atomicidad y la carrera se prueban contra PostgreSQL real
 * (`close-shift.postgres.test.ts`). Lo que este doble fija es que el caso de uso **lea y escriba adentro
 * del alcance**, y que el bloqueo del turno se consulte ahí.
 */
export function runInMemoryShiftTransaction(
  scope: Omit<CloseShiftScope, "lockShift">,
): <T>(work: (scope: CloseShiftScope) => Promise<T>) => Promise<T> {
  return (work) =>
    work({
      ...scope,
      lockShift: (shiftId) => lockFromInMemory(scope.shiftRepository, shiftId),
    });
}

/**
 * El estado del turno para el doble: el repositorio en memoria expone su lista de turnos. `null` si no
 * existe, igual que el `SELECT … FOR UPDATE` de la base (que devuelve cero filas).
 */
function lockFromInMemory(
  repository: ShiftRepository,
  shiftId: string,
): Promise<{ id: string; status: string } | null> {
  const shifts = (repository as { shifts?: Array<{ id: string; status: string }> }).shifts;
  const shift = shifts?.find((candidate) => candidate.id === shiftId);

  return Promise.resolve(shift ? { id: shift.id, status: shift.status } : null);
}
