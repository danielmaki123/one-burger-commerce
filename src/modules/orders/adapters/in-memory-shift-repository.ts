import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type {
  CloseShiftInput,
  OpenShiftInput,
  ShiftRepository,
} from "@/modules/orders/ports/shift-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Doble de test del puerto de turnos.
 *
 * Reproduce la regla que en la base aplica un índice único parcial: una sola caja abierta por local.
 * El doble la chequea antes de insertar (en memoria no hay índice), así que los dos adaptadores
 * hablan igual.
 */
export class InMemoryShiftRepository implements ShiftRepository {
  shifts: ShiftRecord[] = [];

  private nextId() {
    return `shift_${this.shifts.length + 1}`;
  }

  async openShift(input: OpenShiftInput): Promise<ShiftRecord> {
    const alreadyOpen = await this.findOpenShiftByLocation(input.locationId);
    if (alreadyOpen) {
      throw new ShiftError(
        409,
        "CONFLICT",
        "There is already an open shift for this location",
        { locationId: "Ya hay una caja abierta en este local" },
      );
    }

    const now = new Date().toISOString();
    const shift: ShiftRecord = {
      id: this.nextId(),
      locationId: input.locationId,
      userId: input.userId,
      status: "open",
      openedAt: now,
      closedAt: null,
      openingAmount: roundCurrency(input.openingAmount ?? 0),
      closingAmount: null,
      expectedAmount: null,
      difference: null,
      cashCounts: (input.openingCounts ?? []).map((count) => ({
        kind: "opening" as const,
        currency: count.currency.trim().toUpperCase(),
        denomination: count.denomination,
        quantity: count.quantity,
      })),
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.shifts.push(shift);
    return shift;
  }

  async findOpenShiftByLocation(locationId: string): Promise<ShiftRecord | null> {
    return (
      this.shifts.find((shift) => shift.locationId === locationId && shift.status === "open") ??
      null
    );
  }

  async findShiftById(id: string): Promise<ShiftRecord | null> {
    return this.shifts.find((shift) => shift.id === id) ?? null;
  }

  async closeShift(id: string, input: CloseShiftInput): Promise<ShiftRecord | null> {
    const shift = this.shifts.find((s) => s.id === id);
    // Ya cerrado no se vuelve a cerrar: pisar el arqueo de un turno cerrado es perder el conteo que
    // alguien firmó.
    if (!shift || shift.status === "closed") return null;

    const now = new Date().toISOString();
    shift.status = "closed";
    shift.closedAt = now;
    shift.closingAmount =
      input.closingAmount === null ? null : roundCurrency(input.closingAmount);
    shift.expectedAmount = roundCurrency(input.expectedAmount);
    shift.difference =
      input.closingAmount === null
        ? null
        : roundCurrency(shift.closingAmount! - shift.expectedAmount);
    if (input.notes !== undefined) shift.notes = input.notes;
    shift.cashCounts = [
      ...(shift.cashCounts ?? []).filter((count) => count.kind !== "closing"),
      ...(input.closingCounts ?? []).map((count) => ({
        kind: "closing" as const,
        currency: count.currency.trim().toUpperCase(),
        denomination: count.denomination,
        quantity: count.quantity,
      })),
    ];
    shift.updatedAt = now;

    return shift;
  }

  async listShifts(locationId: string): Promise<ShiftRecord[]> {
    return this.shifts
      .filter((shift) => shift.locationId === locationId)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  }
}
