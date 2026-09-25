import { paymentVoidAudit } from "@/app/api/admin/audit-action-helpers";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { voidPayment, type VoidPaymentScope } from "@/modules/orders/features/void-payment/void-payment";

/**
 * TASK-AUD-059 — el cableado de **anular un cobro**: el alcance atómico, los adaptadores y el asiento.
 *
 * La decisión (permiso, motivo, devoluciones vivas, ya anulado) vive en el caso de uso; acá se arma con
 * qué corre. Dos cosas que no se ven en la firma y son las que importan:
 *
 * 1. **El arqueo de la transacción**: leer el cobro, comprobar que no tenga devoluciones vivas y marcarlo
 *    pasan dentro de un solo `$transaction`, con el mismo cliente — si el proceso se corta en el medio no
 *    queda un cobro a medio anular, y una devolución aprobada un instante antes se ve.
 * 2. **El asiento se firma afuera** del hecho, como en el resto del repo: el rastro durable es la propia
 *    fila (`voidedAt` / `voidedByUserId` / `voidReason`, escritos en la transacción) y el log es su copia
 *    indexable, best-effort (`recordAuditAction`).
 */
export async function voidPaymentForRoute(input: {
  paymentId: string;
  role: AdminRole;
  actorUserId: string;
  reason: string;
}) {
  return voidPayment(
    {
      paymentId: input.paymentId,
      actorRole: input.role,
      actorUserId: input.actorUserId,
      reason: input.reason,
    },
    {
      runInVoidPaymentTransaction,
      recordVoidAudit: (audit) => paymentVoidAudit(audit),
    },
  );
}

/**
 * El **límite atómico** de la anulación. Se exporta para que el test de PostgreSQL use **esta** composición
 * y no una copia: un test que se arma su propio runner no prueba el que corre en producción.
 */
export function runInVoidPaymentTransaction<T>(
  work: (scope: VoidPaymentScope) => Promise<T>,
): Promise<T> {
  return getPrismaClient().$transaction(
    async (tx) =>
      work({
        paymentRepository: new PrismaPaymentRepository(tx),
        refundRepository: new PrismaRefundRepository(tx),
      }),
    { timeout: 15_000, maxWait: 10_000 },
  );
}
