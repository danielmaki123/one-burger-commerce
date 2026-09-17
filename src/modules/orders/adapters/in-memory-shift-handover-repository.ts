import type { ShiftHandoverRecord } from "@/modules/orders/domain/shift-handover";
import type {
  CreateShiftHandoverInput,
  ShiftHandoverRepository,
} from "@/modules/orders/ports/shift-handover-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Tarea 7 del brief (2026-09-17) — doble de test del puerto de traspasos (1.13).
 *
 * Reproduce la semántica del adaptador de Prisma para que un caso de uso no pase acá y falle contra la
 * base: el monto se redondea a dos decimales (`DECIMAL(10,2)`) y el listado va del más viejo al más nuevo.
 *
 * `handovers` es público a propósito: los tests siembran traspasos viejos escribiéndolos directo, igual
 * que el doble de turnos.
 */
export class InMemoryShiftHandoverRepository implements ShiftHandoverRepository {
  handovers: ShiftHandoverRecord[] = [];

  private nextId() {
    return `handover_${this.handovers.length + 1}`;
  }

  async create(input: CreateShiftHandoverInput): Promise<ShiftHandoverRecord> {
    const handover: ShiftHandoverRecord = {
      id: this.nextId(),
      shiftId: input.shiftId,
      locationId: input.locationId,
      handedByUserId: input.handedByUserId,
      handedByName: input.handedByName,
      receivedByName: input.receivedByName,
      expectedAmount: roundCurrency(input.expectedAmount),
      expectedByCurrency: input.expectedByCurrency ?? null,
      notes: input.notes ?? null,
      createdAt: new Date().toISOString(),
    };

    this.handovers.push(handover);
    return handover;
  }

  async listByShift(shiftId: string): Promise<ShiftHandoverRecord[]> {
    return this.handovers
      .filter((handover) => handover.shiftId === shiftId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
