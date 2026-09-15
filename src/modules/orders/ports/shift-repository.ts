import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import type { ShiftRecord } from "@/modules/orders/domain/order.types";

export type OpenShiftInput = {
  locationId: string;
  /** Quién abre la caja. */
  userId: string;
  /** Fondo con el que arranca. Sin dato es 0. */
  openingAmount?: number;
  /**
   * TASK-305 — con qué billetes se abre, por moneda. Si viene, el fondo se **deriva** del conteo:
   * el total y los billetes no pueden discrepar.
   */
  openingCounts?: ShiftCashCountInput[];
  notes?: string | null;
};

export type CloseShiftInput = {
  /**
   * Lo que se contó en la caja al cerrar.
   *
   * `null` explícito = cierre **ciego**: se guarda el esperado y la diferencia queda sin calcular
   * hasta que se cuente. Es una decisión de operación, no un dato que falte.
   */
  closingAmount: number | null;
  /** Lo que el sistema esperaba según los cobros, congelado al cerrar. */
  expectedAmount: number;
  /** TASK-305 — con qué billetes se cerró, por moneda (se guarda el conteo, no solo el total). */
  closingCounts?: ShiftCashCountInput[];
  notes?: string | null;
};

export interface ShiftRepository {
  /**
   * Abre un turno. El índice único parcial de la base es el que impide dos turnos abiertos en el
   * mismo local: si dos cajas lo intentan a la vez, una sola gana y la otra recibe el error de
   * índice único, que la capa de arriba traduce a conflicto.
   */
  openShift(input: OpenShiftInput): Promise<ShiftRecord>;
  /** El turno abierto del local, o `null` si la caja está cerrada. */
  findOpenShiftByLocation(locationId: string): Promise<ShiftRecord | null>;
  findShiftById(id: string): Promise<ShiftRecord | null>;
  /**
   * Cierra un turno y devuelve el turno cerrado. `null` si no existe o si **ya estaba cerrado**
   * (cerrar dos veces no puede pisar el arqueo del primero).
   */
  closeShift(id: string, input: CloseShiftInput): Promise<ShiftRecord | null>;
  /** Turnos de un local, del más nuevo al más viejo. */
  listShifts(locationId: string): Promise<ShiftRecord[]>;
}
