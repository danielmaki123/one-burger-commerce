import { paidOrderCancelledAudit } from "@/app/api/admin/audit-action-helpers";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { updateOrderStatus } from "@/modules/orders/features/update-order-status/update-order-status";

/**
 * Bloque 3.5 del roadmap del POS (Fase 2) — el cambio de estado del pedido, con sus dependencias.
 *
 * Vive acá y no en el `route.ts` porque el repo tiene un tope de 50 líneas por handler y porque esa
 * composición es la que necesita el bloque: al cancelar un pedido **cobrado**, los cobros entran para
 * dejar la devolución pendiente y el aviso al admin (A-15 del backlog de UI). Antes el cobro de un
 * pedido cancelado seguía contando en el arqueo y nadie se enteraba.
 *
 * Bloque 13.1: si el caso de uso creó devoluciones, la cancelación queda firmada con cuánta plata hay que
 * devolver. Un pedido sin cobros se cancela igual y no firma nada: no hay nada que explicar.
 */
export async function applyOrderStatusChange(input: {
  orderId: string;
  status: string;
  note?: string | null;
  changedByUserId: string;
}) {
  const result = await updateOrderStatus(
    input.orderId,
    {
      status: input.status,
      note: input.note,
      changedByUserId: input.changedByUserId,
    },
    {
      repository: new PrismaOrderRepository(),
      paymentRepository: new PrismaPaymentRepository(),
      refundRepository: new PrismaRefundRepository(),
    },
  );

  if ((result.meta?.refundsRequested ?? 0) > 0) {
    await paidOrderCancelledAudit({
      actorUserId: input.changedByUserId,
      orderId: input.orderId,
      refundsRequested: result.meta?.refundsRequested ?? 0,
    });
  }

  return result;
}
