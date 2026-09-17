import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import type {
  CreatePaymentInput,
  PaymentRepository,
  PaymentSummary,
} from "@/modules/orders/ports/payment-repository";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function mapPayment(payment: {
  id: string;
  orderId: string;
  method: string;
  amount: Decimal;
  currency: string | null;
  changeAmount: Decimal;
  tip: Decimal;
  reference: string | null;
  createdAt: Date;
}): PaymentRecord {
  return {
    id: payment.id,
    orderId: payment.orderId,
    method: payment.method as PaymentMethodType,
    amount: decimalToNumber(payment.amount),
    currency: payment.currency,
    changeAmount: decimalToNumber(payment.changeAmount),
    tip: decimalToNumber(payment.tip),
    reference: payment.reference,
    createdAt: payment.createdAt.toISOString(),
  };
}

/**
 * Ventana de tiempo traducida al `where` de Prisma. Sin extremos no filtra por fecha, así que una
 * llamada sin rango se comporta como antes.
 */
function rangeFilter(range?: { from?: string; to?: string }) {
  if (!range || (!range.from && !range.to)) return {};

  return {
    createdAt: {
      ...(range.from ? { gte: new Date(range.from) } : {}),
      ...(range.to ? { lte: new Date(range.to) } : {}),
    },
  };
}

export class PrismaPaymentRepository implements PaymentRepository {
  /** Bloque 3 del POS — el cobro por su id, para devolverlo con su medio y su moneda originales. */
  async findPaymentById(id: string): Promise<PaymentRecord | null> {
    const prisma = getPrismaClient();
    const payment = await prisma.payment.findUnique({ where: { id } });

    return payment ? mapPayment(payment) : null;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const prisma = getPrismaClient();
    const payment = await prisma.payment.create({
      data: {
        orderId: input.orderId,
        method: input.method,
        amount: input.amount,
        currency: input.currency ?? null,
        changeAmount: input.changeAmount ?? 0,
        tip: input.tip ?? 0,
        reference: input.reference ?? null,
      },
    });

    return mapPayment(payment);
  }

  async listPaymentsByOrder(
    orderId: string,
    range?: { from?: string; to?: string },
  ): Promise<PaymentRecord[]> {
    const prisma = getPrismaClient();
    const payments = await prisma.payment.findMany({
      where: { orderId, ...rangeFilter(range) },
      orderBy: { createdAt: "asc" },
    });

    return payments.map(mapPayment);
  }

  async listPaymentsInRange(
    locationId: string,
    range: { from?: string; to?: string },
  ): Promise<PaymentRecord[]> {
    const prisma = getPrismaClient();
    // El local sale del pedido: `Payment` no lo guarda (sería dato duplicado que puede quedar viejo).
    const payments = await prisma.payment.findMany({
      where: { order: { locationId }, ...rangeFilter(range) },
      orderBy: { createdAt: "asc" },
    });

    return payments.map(mapPayment);
  }

  async getPaymentSummary(orderId: string): Promise<PaymentSummary> {
    const prisma = getPrismaClient();
    // La suma la hace la base: es lo que usa el arqueo de caja y no tiene por qué traer las filas.
    const summary = await prisma.payment.aggregate({
      where: { orderId },
      _count: { _all: true },
      _sum: { amount: true, tip: true },
    });

    return {
      count: summary._count._all,
      totalAmount: summary._sum.amount ? decimalToNumber(summary._sum.amount) : 0,
      totalTip: summary._sum.tip ? decimalToNumber(summary._sum.tip) : 0,
    };
  }
}
