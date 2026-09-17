import { redirect } from "next/navigation";

import { canManageCash } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import { AdminEmptyState, AdminPageHeader } from "../_components/admin-operational-ui";

/**
 * Bloque 8.3 del roadmap del POS (Fase 2) — la bandeja de aprobaciones.
 *
 * La ruta existe y es la puerta correcta, pero **la cola todavía no tiene de dónde llenarse**: las
 * devoluciones (Bloque 3) y los movimientos de caja grandes (Bloque 2) son los que van a pedir
 * aprobación, y ninguno de los dos existe todavía. Se dice con esas palabras en vez de mostrar una
 * lista que nunca va a tener nada ni un "próximamente" decorativo: es el mismo criterio del repo (si
 * el backend no tiene el dato, el copy no miente).
 */
export default async function AdminApprovalsPage() {
  const session = await requireAdminSession();

  if (!canManageCash(session.user.role)) {
    redirect("/admin/orders");
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Aprobaciones"
        description="Lo que necesita la firma de un responsable antes de tocar la caja: devoluciones y retiros por encima del límite."
      />

      <AdminEmptyState
        title="Nada pendiente de aprobación"
        description="Esta bandeja se llena cuando existan devoluciones y movimientos de caja. Hoy no hay ninguno de los dos."
      />
    </div>
  );
}
