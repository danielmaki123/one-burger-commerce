import type { PaymentRecord } from "@/modules/orders/domain/order.types";
import { getPrismaClient, type DatabaseClient } from "@/infrastructure/database/prisma";
import type { PaymentLookup } from "@/modules/payments/ports/payment-lookup";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-71`) — el adaptador de Prisma de la búsqueda por clave.
 *
 * La unicidad la garantiza el índice único **parcial** (`WHERE "idempotencyKey" IS NOT NULL`, migración
 * `20260929120200`), que es lo que realmente gana una carrera entre dos requests simultáneos. Esta consulta
 * es la otra mitad: el reintento **secuencial** (doble click, retry de red) devuelve el cobro que ya existe
 * en vez de escribir otro.
 */
export class PrismaPaymentLookup implements PaymentLookup {
  constructor(private readonly client: DatabaseClient = getPrismaClient()) {}

  async findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    const normalized = key.trim();
    if (normalized.length === 0) return null;

    const payment = await this.client.payment.findFirst({
      where: { idempotencyKey: normalized },
    });

    if (!payment) return null;

    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      amount: Number(payment.amount.toString()),
      currency: payment.currency,
      changeAmount: Number(payment.changeAmount.toString()),
      tip: Number(payment.tip.toString()),
      reference: payment.reference,
      createdAt: payment.createdAt.toISOString(),
      voidedAt: payment.voidedAt ? payment.voidedAt.toISOString() : null,
      voidedByUserId: payment.voidedByUserId,
      voidReason: payment.voidReason,
      baseCurrencyCode: payment.baseCurrencyCode,
      exchangeRate: payment.exchangeRate ? Number(payment.exchangeRate.toString()) : null,
      baseAmount: payment.baseAmount ? Number(payment.baseAmount.toString()) : null,
      paymentMethodId: payment.paymentMethodId,
      methodKind: payment.methodKind,
      entityId: payment.entityId,
      idempotencyKey: payment.idempotencyKey,
    };
  }
}
