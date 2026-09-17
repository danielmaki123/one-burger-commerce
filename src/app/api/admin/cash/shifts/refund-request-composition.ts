import { refundRequestAudit } from "@/app/api/admin/audit-action-helpers";
import type { RefundRequestPayload } from "@/app/api/admin/approvals/refunds-payload";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { registerRefundAlert } from "@/modules/notifications/features/register-alert-event/register-alert-event";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { requestRefund } from "@/modules/orders/features/refund/request-refund/request-refund";

/**
 * Bloque 3.3 + 13.1 + tarea 8 del brief (alertas Telegram) — pedir una devolución, firmarla y avisar.
 *
 * Pedir la devolución y firmarla son la misma operación: la plata que sale del cajón tiene que poder
 * explicarse después (quién la pidió, sobre qué pedido, por cuánto y si nació aprobada o pendiente).
 *
 * Además, si el monto supera el umbral que el owner configuró, queda **registrado el aviso** para su grupo
 * de Telegram. El aviso es **best-effort**: si el registro falla, la devolución ya está pedida y la
 * respuesta no se cae. Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas.
 */
export async function requestShiftRefund(input: {
  payload: RefundRequestPayload;
  actorUserId: string;
  canApprove: boolean;
  locationId: string;
}) {
  const result = await requestRefund(
    {
      ...input.payload,
      requestedByUserId: input.actorUserId,
      canApprove: input.canApprove,
      locationId: input.locationId,
    },
    {
      paymentRepository: new PrismaPaymentRepository(),
      refundRepository: new PrismaRefundRepository(),
      shiftRepository: new PrismaShiftRepository(),
    },
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
