import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { ShiftRecord, ShiftStatus } from "@/modules/orders/domain/order.types";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type {
  CloseShiftInput,
  OpenShiftInput,
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
  openedAt: Date;
  closedAt: Date | null;
  openingAmount: Decimal;
  closingAmount: Decimal | null;
  expectedAmount: Decimal | null;
  expectedByCurrency?: unknown;
  cashSalesAmount: Decimal | null;
  difference: Decimal | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  cashCounts?: { kind: string; currency: string; denomination: Decimal; quantity: number }[];
}): ShiftRecord {
  return {
    id: shift.id,
    locationId: shift.locationId,
    userId: shift.userId,
    status: shift.status as ShiftStatus,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    openingAmount: decimalToNumber(shift.openingAmount),
    closingAmount: decimalOrNull(shift.closingAmount),
    expectedAmount: decimalOrNull(shift.expectedAmount),
    // Bloque 1.1/1.2: el arqueo congelado al cerrar, tal como se guardó.
    expectedByCurrency: toExpectedByCurrency(shift.expectedByCurrency),
    cashSalesAmount: decimalOrNull(shift.cashSalesAmount),
    difference: decimalOrNull(shift.difference),
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
      // La regla la aplica el índice único parcial de la migración (un solo `open` por local). Dos
      // cajas que abren a la vez: una gana y la otra cae acá. Se traduce a conflicto de dominio para
      // que la capa de arriba no tenga que conocer el error de Prisma.
      if (isUniqueConstraintError(error)) {
        const open = await this.findOpenShiftByLocation(input.locationId);
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

  async findOpenShiftByLocation(locationId: string): Promise<ShiftRecord | null> {
    const prisma = getPrismaClient();
    const shift = await prisma.shift.findFirst({
      where: { locationId, status: "open" },
      include: { cashCounts: true },
    });

    return shift ? mapShift(shift) : null;
  }

  async findShiftById(id: string): Promise<ShiftRecord | null> {
    const prisma = getPrismaClient();
    const shift = await prisma.shift.findUnique({ where: { id }, include: { cashCounts: true } });

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
        difference:
          input.closingAmount === null
            ? null
            : roundCurrency(input.closingAmount - input.expectedAmount),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (result.count === 0) return null;

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
      include: { cashCounts: true },
      orderBy: { openedAt: "desc" },
    });

    return shifts.map(mapShift);
  }
}
