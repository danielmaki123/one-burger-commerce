import type { ShiftHandoverRecord } from "@/modules/orders/domain/shift-handover";

/**
 * Tarea 7 del brief (2026-09-17) — el puerto de los **traspasos de caja** (1.13).
 *
 * Se guardan, no se recalculan: el esperado de un traspaso es lo que los dos cajeros firmaron en ese
 * momento. Recalcularlo después —con la tasa de cambio de hoy o con cobros que entraron más tarde— diría
 * un número que nadie firmó, que es justo lo que este registro tiene que evitar.
 */
export type CreateShiftHandoverInput = {
  shiftId: string;
  locationId: string;
  /** Quién entrega (usuario del panel). */
  handedByUserId: string | null;
  handedByName: string | null;
  /** Quién recibe, ya normalizado por `resolveHandoverReceiver`. */
  receivedByName: string;
  /** El esperado del corte X al firmar. */
  expectedAmount: number;
  expectedByCurrency?: Record<string, number> | null;
  notes?: string | null;
};

export interface ShiftHandoverRepository {
  create(input: CreateShiftHandoverInput): Promise<ShiftHandoverRecord>;
  /** Los traspasos de un turno, del más viejo al más nuevo: es el orden en que la caja cambió de manos. */
  listByShift(shiftId: string): Promise<ShiftHandoverRecord[]>;
}
