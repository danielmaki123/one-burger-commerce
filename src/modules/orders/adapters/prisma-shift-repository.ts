import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { ShiftRecord, ShiftStatus } from "@/modules/orders/domain/order.types";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type {
  CloseShiftInput,
  OpenShiftInput,
  ReopenShiftInput,
  ShiftRepository,
} from "@/modules/orders/ports/shift-repository";
import { roundCurrency } from "@/shared/lib/order-totals";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function decimalOrNull(d: Decimal | null): number | null {
  return d === null ? null : decimalToNumber(d);
}

function mapShift(shift: {
  id: string;
  locationId: string;
  userId: string;
  status: string;
  terminalId?: string | null;
  openedAt: Date;
  closedAt: Date | null;
  openingAmount: Decimal;
  closingAmount: Decimal | null;
  expectedAmount: Decimal | null;
  expectedByCurrency?: unknown;
  cashSalesAmount: Decimal | null;
  cardSalesAmount?: Decimal | null;
  transferSalesAmount?: Decimal | null;
  otherSalesAmount?: Decimal | null;
  tipsAmount?: Decimal | null;
  cashMovementsAmount?: Decimal | null;
  refundsAmount?: Decimal | null;
  difference: Decimal | null;
  bankDifferenceAmount?: Decimal | null;
  differenceNotifiedAt?: Date | null;
  reopenedAt?: Date | null;
  reopenedByUserId?: string | null;
  reopenReason?: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  cashCounts?: { kind: string; currency: string; denomination: Decimal; quantity: number }[];
  bankCloses?: {
    bankId: string;
    declaredAmount: Decimal;
    currency: string;
    lote: string | null;
    terminalLabel: string | null;
    notes: string | null;
    bank?: { name: string; code: string | null } | null;
  }[];
}): ShiftRecord {
  return {
    id: shift.id,
    locationId: shift.locationId,
    userId: shift.userId,
    status: shift.status as ShiftStatus,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    terminalId: shift.terminalId ?? null,
    openingAmount: decimalToNumber(shift.openingAmount),
    closingAmount: decimalOrNull(shift.closingAmount),
    expectedAmount: decimalOrNull(shift.expectedAmount),
    // Bloque 1.1/1.2: el arqueo congelado al cerrar, tal como se guardó.
    expectedByCurrency: toExpectedByCurrency(shift.expectedByCurrency),
    cashSalesAmount: decimalOrNull(shift.cashSalesAmount),
    // Tarea 1.2: el desglose por medio, tal como quedó al cerrar.
    cardSalesAmount: decimalOrNull(shift.cardSalesAmount ?? null),
    transferSalesAmount: decimalOrNull(shift.transferSalesAmount ?? null),
    otherSalesAmount: decimalOrNull(shift.otherSalesAmount ?? null),
    tipsAmount: decimalOrNull(shift.tipsAmount ?? null),
    cashMovementsAmount: decimalOrNull(shift.cashMovementsAmount ?? null),
    refundsAmount: decimalOrNull(shift.refundsAmount ?? null),
    difference: decimalOrNull(shift.difference),
    // Fase 3 del rediseño de Caja: el cuadre por banco congelado y la firma del aviso.
    bankDifferenceAmount: decimalOrNull(shift.bankDifferenceAmount ?? null),
    differenceNotifiedAt: shift.differenceNotifiedAt
      ? shift.differenceNotifiedAt.toISOString()
      : null,
    // Bloque 1.10: la firma de la última reapertura, si hubo.
    reopenedAt: shift.reopenedAt ? shift.reopenedAt.toISOString() : null,
    reopenedByUserId: shift.reopenedByUserId ?? null,
    reopenReason: shift.reopenReason ?? null,
    notes: shift.notes,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
    // TASK-305: los conteos llegan solo si la consulta los pide (include); sin ellos la lista queda
    // vacía en vez de romper el turno.
    cashCounts: (shift.cashCounts ?? []).map((count) => ({
      kind: count.kind as "opening" | "closing",
      currency: count.currency,
      denomination: decimalToNumber(count.denomination),
      quantity: count.quantity,
    })),
    // Fase 3: el cuadre por banco, con el nombre del banco (el cierre lo imprime: un id no lo lee nadie).
    bankCloses: (shift.bankCloses ?? []).map((close) => ({
      bankId: close.bankId,
      bankName: close.bank?.name,
      bankCode: close.bank?.code ?? null,
      declaredAmount: decimalToNumber(close.declaredAmount),
      currency: close.currency,
      lote: close.lote,
      terminalLabel: close.terminalLabel,
      notes: close.notes,
    })),
  };
}

/** El error de índice único de Prisma, misma detección que el resto del repo. */
function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  return (error as { code?: unknown }).code === "P2002";
}

/**
 * El JSON del esperado por moneda, saneado.
 *
 * Es una columna `Json`, así que puede volver cualquier cosa (un turno viejo no la tiene, y nada
 * impide que alguien escriba un número suelto): se devuelve solo si es un objeto de números, y `null`
 * si no. Una pantalla que muestre `[object Object]` es peor que una que no muestre el detalle.
 */
function toExpectedByCurrency(value: unknown): Record<string, number> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, amount]) => typeof amount === "number" && Number.isFinite(amount),
  );

  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, number>) : null;
}

export class PrismaShiftRepository implements ShiftRepository {
  async openShift(input: OpenShiftInput): Promise<ShiftRecord> {
    const prisma = getPrismaClient();

    try {
      const shift = await prisma.shift.create({
        data: {
          locationId: input.locationId,
          userId: input.userId,
          // Fase 6 del rediseño de Caja: la terminal donde se abre esta caja (`null` = una sola por local).
          terminalId: input.terminalId ?? null,
          openingAmount: input.openingAmount ?? 0,
          notes: input.notes ?? null,
          cashCounts: input.openingCounts?.length
            ? {
                create: input.openingCounts.map((count) => ({
                  kind: "opening" as const,
                  currency: count.currency.trim().toUpperCase(),
                  denomination: count.denomination,
                  quantity: count.quantity,
                })),
              }
            : undefined,
        },
        include: { cashCounts: true },
      });

      return mapShift(shift);
    } catch (error) {
      // La regla la aplica el índice único parcial de la migración (un solo `open` por terminal dentro del
      // local, y por local cuando el turno no tiene terminal). Dos terminales que abren a la vez: una gana
      // y la otra cae acá. Se traduce a conflicto de dominio para que la capa de arriba no conozca Prisma.
      if (isUniqueConstraintError(error)) {
        const open = await this.findOpenShiftByLocation(input.locationId, input.terminalId ?? null);
        if (open) {
          throw new ShiftError(
            409,
            "CONFLICT",
            "There is already an open shift for this location",
            { locationId: "Ya hay una caja abierta en este local" },
          );
        }
      }

      throw error;
    }
  }

  async findOpenShiftByLocation(
    locationId: string,
    terminalId?: string | null,
  ): Promise<ShiftRecord | null> {
    const prisma = getPrismaClient();
    const shift = await prisma.shift.findFirst({
      // Fase 6: con terminal, el turno de esa terminal; sin ella, el turno sin terminal (una caja por local).
      where: { locationId, status: "open", terminalId: terminalId ?? null },
      include: { cashCounts: true, bankCloses: { include: { bank: true } } },
    });

    return shift ? mapShift(shift) : null;
  }

  async findShiftById(id: string): Promise<ShiftRecord | null> {
    const prisma = getPrismaClient();
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: { cashCounts: true, bankCloses: { include: { bank: true } } },
    });

    return shift ? mapShift(shift) : null;
  }

  async closeShift(id: string, input: CloseShiftInput): Promise<ShiftRecord | null> {
    const prisma = getPrismaClient();

    // El `status: "open"` en el WHERE es la guarda contra cerrar dos veces: si otra terminal ya
    // cerró el turno, `updateMany` afecta 0 filas y no se pisa el arqueo del primero.
    const result = await prisma.shift.updateMany({
      where: { id, status: "open" },
      data: {
        status: "closed",
        closedAt: new Date(),
        closingAmount: input.closingAmount,
        expectedAmount: input.expectedAmount,
        // Bloque 1.1/1.2: el arqueo por moneda y el efectivo del turno quedan congelados acá. El
        // detalle por moneda antes vivía solo en la respuesta y se perdía al recargar.
        expectedByCurrency: input.expectedByCurrency,
        cashSalesAmount: input.cashSalesAmount,
    cardSalesAmount: input.cardSalesAmount ?? 0,
    transferSalesAmount: input.transferSalesAmount ?? 0,
    otherSalesAmount: input.otherSalesAmount ?? 0,
    tipsAmount: input.tipsAmount ?? 0,
        cashMovementsAmount: input.cashMovementsAmount ?? 0,
        refundsAmount: input.refundsAmount ?? 0,
        difference:
          input.closingAmount === null
            ? null
            : roundCurrency(input.closingAmount - input.expectedAmount),
        // Fase 3 del rediseño de Caja: la diferencia del cuadre por banco queda congelada con el arqueo.
        bankDifferenceAmount: input.bankDifferenceAmount ?? null,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (result.count === 0) return null;

    // Fase 3: el cuadre por banco se guarda tal como se declaró (lote y terminal incluidos). Se borra
    // primero porque un turno **reabierto** puede volver a cerrarse con otro cuadre y no se puede
    // duplicar la fila de un banco y una moneda (el índice único lo rechazaría).
    if (input.bankCloses !== undefined) {
      await prisma.shiftBankClose.deleteMany({ where: { shiftId: id } });

      if (input.bankCloses.length > 0) {
        await prisma.shiftBankClose.createMany({
          data: input.bankCloses.map((close) => ({
            shiftId: id,
            bankId: close.bankId.trim(),
            declaredAmount: close.declaredAmount,
            currency: close.currency.trim().toUpperCase(),
            lote: close.lote?.trim() || null,
            terminalLabel: close.terminalLabel?.trim() || null,
            notes: close.notes?.trim() || null,
          })),
          skipDuplicates: true,
        });
      }
    }

    // TASK-305: el conteo del cierre se guarda tal como se contó (billete por billete), no solo el
    // total: así el arqueo se puede reconstruir y volver a revisar.
    if (input.closingCounts?.length) {
      await prisma.shiftCashCount.createMany({
        data: input.closingCounts.map((count) => ({
          shiftId: id,
          kind: "closing" as const,
          currency: count.currency.trim().toUpperCase(),
          denomination: count.denomination,
          quantity: count.quantity,
        })),
        skipDuplicates: true,
      });
    }

    return this.findShiftById(id);
  }

  async listShifts(locationId: string): Promise<ShiftRecord[]> {
    const prisma = getPrismaClient();
    const shifts = await prisma.shift.findMany({
      where: { locationId },
      include: { cashCounts: true, bankCloses: { include: { bank: true } } },
      orderBy: { openedAt: "desc" },
    });

    return shifts.map(mapShift);
  }

  /**
   * Bloque 1.10 — reabre un turno cerrado.
   *
   * El `status: "closed"` en el `WHERE` es la guarda contra reabrir lo que ya está abierto (o dos
   * terminales reabriendo a la vez). El índice único parcial de la base hace el resto: si el local ya
   * tiene una caja abierta, la operación choca con P2002 y se traduce a conflicto, igual que al abrir.
   */
  async reopenShift(id: string, input: ReopenShiftInput): Promise<ShiftRecord | null> {
    const prisma = getPrismaClient();

    try {
      const result = await prisma.shift.updateMany({
        where: { id, status: "closed" },
        data: {
          status: "open",
          // El turno vuelve a estar abierto: el próximo cierre calcula y firma un arqueo nuevo.
          closedAt: null,
          // Fase 3: el aviso anterior ya no vale — el próximo cierre avisa un número distinto.
          differenceNotifiedAt: null,
          reopenedAt: new Date(),
          reopenedByUserId: input.userId,
          reopenReason: input.reason.trim(),
        },
      });

      if (result.count === 0) return null;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ShiftError(409, "CONFLICT", "There is already an open shift for this location", {
          locationId: "Ya hay una caja abierta en este local",
        });
      }

      throw error;
    }

    return this.findShiftById(id);
  }

  async markDifferenceNotified(id: string, notifiedAt: string): Promise<void> {
    await getPrismaClient().shift.updateMany({
      where: { id },
      data: { differenceNotifiedAt: new Date(notifiedAt) },
    });
  }
}
