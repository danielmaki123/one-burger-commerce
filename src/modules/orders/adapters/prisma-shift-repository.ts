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
  difference: Decimal | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
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
    difference: decimalOrNull(shift.difference),
    notes: shift.notes,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
  };
}

/** El error de índice único de Prisma, misma detección que el resto del repo. */
function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  return (error as { code?: unknown }).code === "P2002";
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
        },
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
    });

    return shift ? mapShift(shift) : null;
  }

  async findShiftById(id: string): Promise<ShiftRecord | null> {
    const prisma = getPrismaClient();
    const shift = await prisma.shift.findUnique({ where: { id } });

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
        difference:
          input.closingAmount === null
            ? null
            : roundCurrency(input.closingAmount - input.expectedAmount),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    if (result.count === 0) return null;

    return this.findShiftById(id);
  }

  async listShifts(locationId: string): Promise<ShiftRecord[]> {
    const prisma = getPrismaClient();
    const shifts = await prisma.shift.findMany({
      where: { locationId },
      orderBy: { openedAt: "desc" },
    });

    return shifts.map(mapShift);
  }
}
