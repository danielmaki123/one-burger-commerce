import { paidOrderCancelledAudit } from "@/app/api/admin/audit-action-helpers";
import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { assertKitchenStatusTransition } from "@/modules/orders/domain/order-kitchen-transitions";
import { updateOrderStatus } from "@/modules/orders/features/update-order-status/update-order-status";
import type { OrderStatus, OrderType } from "@/modules/orders/domain/order.types";

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
 *
 * `TASK-ORDERS-KITCHEN-RUNTIME-002`: además se aplica la **capacidad de Cocina** en el servidor
 * (`assertKitchenStatusTransition`) **cuando quien opera es el rol de cocina**, para que ese rol no pueda
 * retirar ni cerrar el pedido aunque llegue a esta ruta. El dueño y el manager siguen operando el flujo
 * completo del mostrador —retirar y cerrar es de Pedidos—, así que la capacidad se recorta por rol y no
 * para todos: una puerta que bloqueara al dueño sería un defecto, no una autorización.
 */
export async function applyOrderStatusChange(input: {
  orderId: string;
  status: string;
  note?: string | null;
  changedByUserId: string;
  /** El rol que firma el cambio: la capacidad de Cocina se recorta sobre él. */
  actorRole: AdminRole;
  /** El pedido ya leído por el handler: el tipo y el estado actual son lo que valida la capacidad. */
  order: { type: OrderType; status: OrderStatus };
}) {
  // El rol de cocina no retira ni cierra: eso lo firma el mostrador. Los otros roles no se recortan.
  if (input.actorRole === ADMIN_ROLES.kitchen) {
    assertKitchenStatusTransition({
      type: input.order.type,
      current: input.order.status,
      next: input.status as OrderStatus,
    });
  }

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
