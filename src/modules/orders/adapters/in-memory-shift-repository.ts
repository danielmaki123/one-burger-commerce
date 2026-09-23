import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type {
  CloseShiftInput,
  OpenShiftInput,
  ReopenShiftInput,
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
    const alreadyOpen = await this.findOpenShiftByLocation(
      input.locationId,
      input.terminalId ?? null,
    );
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
      // Fase 6 del rediseño de Caja: la terminal donde se abre esta caja (`null` = una sola por local).
      terminalId: input.terminalId ?? null,
      status: "open",
      openedAt: now,
      closedAt: null,
      openingAmount: roundCurrency(input.openingAmount ?? 0),
      closingAmount: null,
      expectedAmount: null,
      expectedByCurrency: null,
      cashSalesAmount: null,
      cardSalesAmount: null,
      transferSalesAmount: null,
      otherSalesAmount: null,
      tipsAmount: null,
      cashMovementsAmount: null,
      refundsAmount: null,
      difference: null,
      // Fase 3 del rediseño de Caja: el cuadre por banco nace vacío y la firma del aviso, sin fecha.
      bankDifferenceAmount: null,
      differenceNotifiedAt: null,
      bankCloses: [],
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

  async findOpenShiftByLocation(
    locationId: string,
    terminalId?: string | null,
  ): Promise<ShiftRecord | null> {
    return (
      this.shifts.find(
        (shift) =>
          shift.locationId === locationId &&
          shift.status === "open" &&
          // Fase 6: con terminal, el turno de esa terminal; sin ella, el turno **sin** terminal (una sola
          // caja por local, que es como se comporta una sucursal sin terminales cargadas).
          (shift.terminalId ?? null) === (terminalId ?? null),
      ) ?? null
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
    // Bloque 1.1/1.2: el arqueo se congela al cerrar, no se recalcula al leer.
    shift.expectedByCurrency = { ...(input.expectedByCurrency ?? {}) };
    shift.cashSalesAmount = roundCurrency(input.cashSalesAmount ?? 0);
    shift.cardSalesAmount = roundCurrency(input.cardSalesAmount ?? 0);
    shift.transferSalesAmount = roundCurrency(input.transferSalesAmount ?? 0);
    shift.otherSalesAmount = roundCurrency(input.otherSalesAmount ?? 0);
    shift.tipsAmount = roundCurrency(input.tipsAmount ?? 0);
    shift.cashMovementsAmount = roundCurrency(input.cashMovementsAmount ?? 0);
    shift.refundsAmount = roundCurrency(input.refundsAmount ?? 0);
    shift.difference =
      input.closingAmount === null
        ? null
        : roundCurrency(shift.closingAmount! - shift.expectedAmount);
    if (input.notes !== undefined) shift.notes = input.notes;
    // Fase 3: el cuadre por banco se guarda tal como se declaró (y se reemplaza: un turno reabierto se
    // vuelve a cerrar con otro cuadre).
    shift.bankDifferenceAmount =
      input.bankDifferenceAmount === undefined
        ? null
        : input.bankDifferenceAmount === null
          ? null
          : roundCurrency(input.bankDifferenceAmount);

    if (input.bankCloses !== undefined) {
      shift.bankCloses = input.bankCloses.map((close) => ({
        bankId: close.bankId.trim(),
        declaredAmount: roundCurrency(close.declaredAmount),
        currency: close.currency.trim().toUpperCase(),
        lote: close.lote?.trim() || null,
        terminalLabel: close.terminalLabel?.trim() || null,
        notes: close.notes?.trim() || null,
      }));
    }
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

  /**
   * Bloque 1.10 — reabre un turno cerrado. Reproduce las dos reglas de la base y del caso de uso:
   * solo un turno **cerrado** se reabre, y el local no puede quedar con dos cajas abiertas (en la
   * base lo impide el índice único parcial; acá se comprueba antes, igual que en `openShift`).
   */
  async reopenShift(id: string, input: ReopenShiftInput): Promise<ShiftRecord | null> {
    const shift = this.shifts.find((s) => s.id === id);
    if (!shift || shift.status !== "closed") return null;

    const alreadyOpen = await this.findOpenShiftByLocation(shift.locationId);
    if (alreadyOpen) {
      throw new ShiftError(
        409,
        "CONFLICT",
        "There is already an open shift for this location",
        { locationId: "Ya hay una caja abierta en este local" },
      );
    }

    const now = new Date().toISOString();
    shift.status = "open";
    // El turno vuelve a estar abierto: el próximo cierre calcula y firma un arqueo nuevo.
    shift.closedAt = null;
    // Fase 3: el aviso anterior ya no vale — el próximo cierre avisa un número distinto.
    shift.differenceNotifiedAt = null;
    shift.reopenedAt = now;
    shift.reopenedByUserId = input.userId;
    shift.reopenReason = input.reason.trim();
    shift.updatedAt = now;

    return shift;
  }

  async markDifferenceNotified(id: string, notifiedAt: string): Promise<void> {
    const shift = this.shifts.find((s) => s.id === id);
    if (!shift) return;

    shift.differenceNotifiedAt = notifiedAt;
    shift.updatedAt = notifiedAt;
  }
}
