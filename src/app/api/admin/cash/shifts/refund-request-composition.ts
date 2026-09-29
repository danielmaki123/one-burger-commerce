import { refundRequestAudit } from "@/app/api/admin/audit-action-helpers";
import type { RefundRequestPayload } from "@/app/api/admin/approvals/refunds-payload";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { registerRefundAlert } from "@/modules/notifications/features/register-alert-event/register-alert-event";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import {
  lockPaymentRow,
  PrismaPaymentRepository,
} from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import {
  requestRefund,
  type RefundRequestScope,
} from "@/modules/orders/features/refund/request-refund/request-refund";

/**
 * Bloque 3.3 + 13.1 + tarea 8 del brief (alertas Telegram) — pedir una devolución, firmarla y avisar.
 *
 * Pedir la devolución y firmarla son la misma operación: la plata que sale del cajón tiene que poder
 * explicarse después (quién la pidió, sobre qué pedido, por cuánto y si nació aprobada o pendiente).
 *
 * Además, si el monto supera el umbral que el owner configuró, queda **registrado el aviso** para su grupo
 * de Telegram. El aviso es **best-effort**: si el registro falla, la devolución ya está pedida y la
 * respuesta no se cae. Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas.
 *
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-73`) — la operación ahora tiene **límite atómico**: el cupo se lee y
 * la devolución se escribe dentro de una transacción que bloquea primero la fila del cobro. El aviso, en
 * cambio, va **después** del commit: una llamada externa adentro de la transacción la alargaría sin razón.
 */
export async function requestShiftRefund(input: {
  payload: RefundRequestPayload;
  actorUserId: string;
  locationId: string;
}) {
  const result = await requestRefund(
    {
      ...input.payload,
      requestedByUserId: input.actorUserId,
      locationId: input.locationId,
    },
    await refundRequestDependenciesForRoute({ runInRefundRequestTransaction }),
  );

  await refundRequestAudit({
    actorUserId: input.actorUserId,
    refundId: result.data.id,
    orderId: result.data.orderId,
    amount: result.data.amount,
    currency: result.data.currency,
    status: result.data.status,
  });

  try {
    // El aviso dice el **número** de pedido (el dueño lee el mensaje, no el cuid de la base).
    const order = await new PrismaOrderRepository().findOrderById(result.data.orderId);

    await registerRefundAlert(
      {
        refundId: result.data.id,
        orderNumber: order?.orderNumber ?? result.data.orderId,
        amount: result.data.amount,
        reason: result.data.reason,
      },
      {
        settingsRepository: new PrismaNotificationSettingsRepository(),
        outboxRepository: new PrismaOutboxRepository(),
      },
    );
  } catch (error) {
    console.warn(
      "[alertas] no se pudo registrar el aviso de devolución:",
      error instanceof Error ? error.message : String(error),
    );
  }

  return result.data;
}

/**
 * `A-73` — **el límite atómico de la devolución**: cupo leído y devolución escrita en la misma transacción,
 * con la fila del cobro bloqueada primero.
 *
 * Se exporta para que el test de PostgreSQL use **esta** composición y no una copia: un test que se arma su
 * propio runner no prueba el que corre en producción.
 */
export function runInRefundRequestTransaction<T>(
  work: (scope: RefundRequestScope) => Promise<T>,
): Promise<T> {
  return getPrismaClient().$transaction(
    async (tx) =>
      work({
        findPaymentById: (id) => new PrismaPaymentRepository(tx).findPaymentById(id),
        listRefundsByPayment: (paymentId) => new PrismaRefundRepository(tx).listByPayment(paymentId),
        createRefund: (input) => new PrismaRefundRepository(tx).create(input),
        findRefundByIdempotencyKey: (key) => new PrismaRefundRepository(tx).findByIdempotencyKey(key),
        lockPayment: (paymentId) => lockPaymentRow(tx, paymentId),
      }),
    { timeout: 15_000, maxWait: 10_000 },
  );
}

/**
 * Las dependencias del caso de uso, armadas una sola vez para la ruta **y** para su test.
 *
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-82`) — el contexto monetario entra por acá y lo lee
 * **`money`**: la moneda base vigente y las tasas con las que la devolución congela su equivalente. Antes
 * esta composición leía `settings.currencyCode` de `BusinessSettings`, que es la autoridad vieja, y la
 * devolución no congelaba nada.
 */
export async function refundRequestDependenciesForRoute(input: {
  runInRefundRequestTransaction: <T>(work: (scope: RefundRequestScope) => Promise<T>) => Promise<T>;
}) {
  return {
    shiftRepository: new PrismaShiftRepository(),
    runInRefundRequestTransaction: input.runInRefundRequestTransaction,
    readMoney: async () => (await readProductionMoney()).context,
  };
}
