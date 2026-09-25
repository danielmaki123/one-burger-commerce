import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient, type DatabaseClient } from "@/infrastructure/database/prisma";
import type { PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import type {
  CreatePaymentInput,
  PaymentRepository,
  PaymentSummary,
  VoidPaymentInput,
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
  voidedAt: Date | null;
  voidedByUserId: string | null;
  voidReason: string | null;
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
    voidedAt: payment.voidedAt ? payment.voidedAt.toISOString() : null,
    voidedByUserId: payment.voidedByUserId,
    voidReason: payment.voidReason,
  };
}

/**
 * TASK-AUD-059 — el filtro que hace que un cobro anulado **no cuente**: ni en el arqueo (por turno o por
 * ventana), ni en el saldo del pedido, ni en la conciliación. Vive una sola vez porque la regla es una
 * sola: un cobro anulado no existió nunca para la plata.
 */
const NOT_VOIDED = { voidedAt: null } as const;

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
  /**
   * TASK-AUD-004 — el repositorio puede correr dentro de una transacción.
   *
   * Sin cliente se usa el raíz (una escritura independiente); con un `tx` inyectado, **todos** los cobros
   * que se escriban por acá entran en esa transacción, que es lo que hace que una venta sea todo o nada.
   */
  constructor(private readonly client: DatabaseClient = getPrismaClient()) {}

  /** Bloque 3 del POS — el cobro por su id, para devolverlo con su medio y su moneda originales. */
  async findPaymentById(id: string): Promise<PaymentRecord | null> {
    const prisma = this.client;
    const payment = await prisma.payment.findUnique({ where: { id } });

    return payment ? mapPayment(payment) : null;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentRecord> {
    const prisma = this.client;
    const payment = await prisma.payment.create({
      data: {
        orderId: input.orderId,
        method: input.method,
        amount: input.amount,
        currency: input.currency ?? null,
        changeAmount: input.changeAmount ?? 0,
        tip: input.tip ?? 0,
        reference: input.reference ?? null,
        // Fase 6 del rediseño de Caja: el turno al que entra el cobro (la caja de la terminal).
        shiftId: input.shiftId ?? null,
      },
    });

    return mapPayment(payment);
  }

  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — los cobros de un turno. Es la consulta del arqueo cuando el
   * local tiene más de una caja abierta: leer por ventana haría que las dos se contaran la misma plata.
   */
  async listPaymentsByShift(shiftId: string): Promise<PaymentRecord[]> {
    const payments = await this.client.payment.findMany({
      where: { shiftId, ...NOT_VOIDED },
      orderBy: { createdAt: "asc" },
    });

    return payments.map(mapPayment);
  }

  async listPaymentsByOrder(
    orderId: string,
    range?: { from?: string; to?: string },
  ): Promise<PaymentRecord[]> {
    const prisma = this.client;
    const payments = await prisma.payment.findMany({
      where: { orderId, ...rangeFilter(range), ...NOT_VOIDED },
      orderBy: { createdAt: "asc" },
    });

    return payments.map(mapPayment);
  }

  async listPaymentsInRange(
    locationId: string,
    range: { from?: string; to?: string },
  ): Promise<PaymentRecord[]> {
    const prisma = this.client;
    // El local sale del pedido: `Payment` no lo guarda (sería dato duplicado que puede quedar viejo).
    const payments = await prisma.payment.findMany({
      where: { order: { locationId }, ...rangeFilter(range), ...NOT_VOIDED },
      orderBy: { createdAt: "asc" },
    });

    return payments.map(mapPayment);
  }

  /**
   * TASK-AUD-054 — los cobros del local en la ventana que **no** tienen turno. El arqueo los suma a los
   * suyos: son los que entraron sin caja abierta y no los va a leer nadie más.
   */
  async listUnattributedPaymentsInRange(
    locationId: string,
    range: { from?: string; to?: string },
  ): Promise<PaymentRecord[]> {
    const prisma = this.client;
    const payments = await prisma.payment.findMany({
      where: { shiftId: null, order: { locationId }, ...rangeFilter(range), ...NOT_VOIDED },
      orderBy: { createdAt: "asc" },
    });

    return payments.map(mapPayment);
  }

  async getPaymentSummary(orderId: string): Promise<PaymentSummary> {
    const prisma = this.client;
    // La suma la hace la base: es lo que usa el arqueo de caja y no tiene por qué traer las filas.
    // TASK-AUD-059: los anulados no suman ni cuentan — el pedido vuelve a tener ese saldo pendiente.
    const summary = await prisma.payment.aggregate({
      where: { orderId, ...NOT_VOIDED },
      _count: { _all: true },
      _sum: { amount: true, tip: true },
    });

    return {
      count: summary._count._all,
      totalAmount: summary._sum.amount ? decimalToNumber(summary._sum.amount) : 0,
      totalTip: summary._sum.tip ? decimalToNumber(summary._sum.tip) : 0,
    };
  }

  /**
   * TASK-AUD-059 — la anulación, con la guarda en el propio `WHERE`: `voidedAt: null` hace que dos
   * anulaciones simultáneas del mismo cobro no puedan pisarse la firma (la segunda afecta 0 filas y
   * devuelve `null`, que el caso de uso traduce a 409). No hay borrado ni edición del cobro original.
   */
  async voidPayment(id: string, input: VoidPaymentInput): Promise<PaymentRecord | null> {
    const prisma = this.client;

    const result = await prisma.payment.updateMany({
      where: { id, ...NOT_VOIDED },
      data: {
        voidedAt: new Date(input.voidedAt),
        voidedByUserId: input.actorUserId,
        voidReason: input.reason,
      },
    });

    if (result.count === 0) return null;

    const voided = await prisma.payment.findUnique({ where: { id } });

    return voided ? mapPayment(voided) : null;
  }
}
