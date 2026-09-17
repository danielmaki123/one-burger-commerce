import { redirect } from "next/navigation";

import { canApproveRefund } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";

import { AdminPageHeader } from "../_components/admin-operational-ui";
import ApprovalsClient from "./approvals-client";

/**
 * Bloque 3.6/8.3 del roadmap del POS (Fase 2) — la bandeja de aprobaciones.
 *
 * Lo que espera la firma de un responsable: las **devoluciones pendientes** (el aviso al cancelar un
 * pedido cobrado deja una acá).
 *
 * Tarea 9 del brief (2026-09-17): la firma es del **dueño** (`canApproveRefund`), así que el manager ya
 * no entra —no puede hacer nada acá— y el cajero que pidió la devolución tampoco: pedir y firmar son dos
 * actos separados a propósito.
 */
export default async function AdminApprovalsPage() {
  const session = await requireAdminSession();

  if (!canApproveRefund(session.user.role)) {
    redirect("/admin/orders");
  }

  const refunds = await new PrismaRefundRepository().listPending();

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Aprobaciones"
        description="Lo que necesita la firma de un responsable antes de tocar la caja: devoluciones de pedidos cancelados o devueltas a mano."
      />

      <ApprovalsClient initialRefunds={refunds} />
    </div>
  );
}
