import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type {
  CashMovementCategory,
  CashMovementKind,
  CashMovementRecord,
} from "@/modules/orders/domain/order.types";
import type {
  CashMovementRepository,
  CreateCashMovementInput,
} from "@/modules/orders/ports/cash-movement-repository";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

/**
 * Bloque 2 del roadmap del POS (Fase 2) — los movimientos de caja en Postgres.
 *
 * El listado va **del más viejo al más nuevo**: es el orden en que pasaron las cosas, y un arqueo se
 * lee así (fondo, movimientos, cierre). Lo usa el detalle del cierre y el cálculo del esperado.
 */
function mapMovement(row: {
  id: string;
  shiftId: string;
  kind: string;
  category: string;
  amount: Decimal;
  currency: string;
  reason: string;
  userId: string;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  withdrawalLimitAmount: Decimal | null;
  createdAt: Date;
}): CashMovementRecord {
  return {
    id: row.id,
    shiftId: row.shiftId,
    kind: row.kind as CashMovementKind,
    category: row.category as CashMovementCategory,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    reason: row.reason,
    userId: row.userId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    withdrawalLimitAmount:
      row.withdrawalLimitAmount === null ? null : decimalToNumber(row.withdrawalLimitAmount),
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaCashMovementRepository implements CashMovementRepository {
  async create(input: CreateCashMovementInput): Promise<CashMovementRecord> {
    const prisma = getPrismaClient();

    const created = await prisma.cashMovement.create({
      data: {
        shiftId: input.shiftId,
        kind: input.kind,
        category: input.category,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason,
        userId: input.userId,
        withdrawalLimitAmount: input.withdrawalLimitAmount ?? null,
      },
    });

    return mapMovement(created);
  }

  async listByShift(shiftId: string): Promise<CashMovementRecord[]> {
    const prisma = getPrismaClient();

    const rows = await prisma.cashMovement.findMany({
      where: { shiftId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(mapMovement);
  }
}
