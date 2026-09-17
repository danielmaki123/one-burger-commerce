import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { ShiftHandoverRecord } from "@/modules/orders/domain/shift-handover";
import type {
  CreateShiftHandoverInput,
  ShiftHandoverRepository,
} from "@/modules/orders/ports/shift-handover-repository";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function toCurrencyMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  return value as Record<string, number>;
}

function mapHandover(row: {
  id: string;
  shiftId: string;
  locationId: string;
  handedByUserId: string | null;
  handedByName: string | null;
  receivedByName: string;
  expectedAmount: Decimal;
  expectedByCurrency: unknown;
  notes: string | null;
  createdAt: Date;
}): ShiftHandoverRecord {
  return {
    id: row.id,
    shiftId: row.shiftId,
    locationId: row.locationId,
    handedByUserId: row.handedByUserId,
    handedByName: row.handedByName,
    receivedByName: row.receivedByName,
    expectedAmount: decimalToNumber(row.expectedAmount),
    expectedByCurrency: toCurrencyMap(row.expectedByCurrency),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Tarea 7 del brief (2026-09-17) — los traspasos de caja en Postgres (1.13).
 *
 * El listado va **del más viejo al más nuevo**, que es el orden en que la caja cambió de manos: leerlo al
 * revés hace difícil seguir la película de un turno largo.
 */
export class PrismaShiftHandoverRepository implements ShiftHandoverRepository {
  async create(input: CreateShiftHandoverInput): Promise<ShiftHandoverRecord> {
    const prisma = getPrismaClient();

    const created = await prisma.shiftHandover.create({
      data: {
        shiftId: input.shiftId,
        locationId: input.locationId,
        handedByUserId: input.handedByUserId,
        handedByName: input.handedByName,
        receivedByName: input.receivedByName,
        expectedAmount: input.expectedAmount,
        expectedByCurrency: input.expectedByCurrency ?? undefined,
        notes: input.notes ?? null,
      },
    });

    return mapHandover(created);
  }

  async listByShift(shiftId: string): Promise<ShiftHandoverRecord[]> {
    const prisma = getPrismaClient();

    const rows = await prisma.shiftHandover.findMany({
      where: { shiftId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(mapHandover);
  }
}
