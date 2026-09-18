import { redirect } from "next/navigation";

import { canViewHistory } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import { CierresClient } from "./cierres-client";

export const dynamic = "force-dynamic";

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial › Cierres**.
 *
 * La página resuelve el permiso en el servidor, como el resto del panel: quien no puede ver el Historial
 * (cajero, cocina) no llega ni escribiendo la URL. Las APIs de la sección responden **403**; acá se
 * redirige al tablero de órdenes, que es lo que hacen todas las pantallas restringidas del admin.
 */
export default async function AdminHistoryCierresPage() {
  const session = await requireAdminSession();

  if (!canViewHistory(session.user.role)) {
    redirect("/admin/orders");
  }

  return <CierresClient />;
}
