import { refundRequestAudit } from "@/app/api/admin/audit-action-helpers";
import type { RefundRequestPayload } from "@/app/api/admin/approvals/refunds-payload";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { requestRefund } from "@/modules/orders/features/refund/request-refund/request-refund";

/**
 * Bloque 3.3 + 13.1 del roadmap del POS (Fase 2) — pedir una devolución y dejar el asiento.
 *
 * Pedir la devolución y firmarla son la misma operación: la plata que sale del cajón tiene que poder
 * explicarse después (quién la pidió, sobre qué pedido, por cuánto y si nació aprobada o pendiente).
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas.
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

  return result.data;
}
