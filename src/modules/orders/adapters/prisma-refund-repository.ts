import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type {
  PaymentMethodType,
  RefundKind,
  RefundRecord,
  RefundStatus,
} from "@/modules/orders/domain/order.types";
import type {
  CreateRefundInput,
  RefundRepository,
} from "@/modules/orders/ports/refund-repository";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function mapRefund(row: {
  id: string;
  paymentId: string;
  orderId: string;
  shiftId: string | null;
  kind: string;
  method: string;
  amount: Decimal;
  currency: string;
  reason: string;
  status: string;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}): RefundRecord {
  return {
    id: row.id,
    paymentId: row.paymentId,
    orderId: row.orderId,
    shiftId: row.shiftId,
    kind: row.kind as RefundKind,
    method: row.method as PaymentMethodType,
    amount: decimalToNumber(row.amount),
    currency: row.currency,
    reason: row.reason,
    status: row.status as RefundStatus,
    requestedByUserId: row.requestedByUserId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Bloque 3 del roadmap del POS (Fase 2) — las devoluciones en Postgres.
 *
 * Los listados van **del más viejo al más nuevo**, que es el orden en que el hecho pasó y el que
 * necesita cada consumidor: el cupo de un cobro se calcula sobre todas sus devoluciones (también las
 * rechazadas, que no consumen pero se conservan), el arqueo lee el turno de principio a fin y la
 * bandeja de aprobaciones es una **cola de trabajo**: la más vieja se atiende primero.
 */
export class PrismaRefundRepository implements RefundRepository {
  async create(input: CreateRefundInput): Promise<RefundRecord> {
    const prisma = getPrismaClient();

    const created = await prisma.refund.create({
      data: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        shiftId: input.shiftId,
        kind: input.kind,
        method: input.method,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason,
        status: input.status,
        requestedByUserId: input.requestedByUserId,
        approvedByUserId: input.approvedByUserId,
        approvedAt: input.approvedAt ? new Date(input.approvedAt) : null,
      },
    });

    return mapRefund(created);
  }

  /** Una devolución por su id, para resolverla. */
  async findById(id: string): Promise<RefundRecord | null> {
    const prisma = getPrismaClient();

    const row = await prisma.refund.findUnique({ where: { id } });

    return row ? mapRefund(row) : null;
  }

  async listByPayment(paymentId: string): Promise<RefundRecord[]> {
    const prisma = getPrismaClient();

    const rows = await prisma.refund.findMany({
      where: { paymentId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(mapRefund);
  }

  async listByShift(shiftId: string): Promise<RefundRecord[]> {
    const prisma = getPrismaClient();

    const rows = await prisma.refund.findMany({
      where: { shiftId },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(mapRefund);
  }

  async listPending(): Promise<RefundRecord[]> {
    const prisma = getPrismaClient();

    const rows = await prisma.refund.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });

    return rows.map(mapRefund);
  }

  /**
   * Resuelve una devolución **pendiente**. El `status: "pending"` va en el `WHERE` a propósito: si
   * otra terminal ya la aprobó (o la rechazó) mientras tanto, esto afecta 0 filas y devuelve `null`
   * en vez de pisar la firma que ya estaba.
   *
   * El `reason` de un rechazo (opcional) reemplaza el motivo original: es el motivo por el que **no**
   * se devolvió, y es el que se lee al mostrar la devolución resuelta.
   */
  async resolve(
    id: string,
    input: {
      status: "approved" | "rejected";
      approvedByUserId: string;
      approvedAt: string;
      reason?: string;
    },
  ): Promise<RefundRecord | null> {
    const prisma = getPrismaClient();

    const result = await prisma.refund.updateMany({
      where: { id, status: "pending" },
      data: {
        status: input.status,
        approvedByUserId: input.approvedByUserId,
        approvedAt: new Date(input.approvedAt),
        // Un rechazo puede traer el motivo nuevo; una aprobación no toca el motivo original.
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      },
    });

    if (result.count === 0) return null;

    const updated = await prisma.refund.findUnique({ where: { id } });

    return updated ? mapRefund(updated) : null;
  }
}
