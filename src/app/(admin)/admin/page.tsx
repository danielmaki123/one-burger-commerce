import { redirect } from "next/navigation";

import { resolveAdminLanding } from "@/modules/auth/domain/admin-landing";
import { canViewAdminOverview } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import AdminOverviewClient from "./_components/admin-overview-client";

/**
 * `/admin` — la **home del panel**.
 *
 * `TASK-ORDERS-RUNTIME-5B` (`A-10`) — el Resumen es del dueño; los demás roles aterrizan en **su** superficie
 * con `resolveAdminLanding`, que es la única respuesta a esa pregunta. Antes esta página mandaba a
 * `/admin/orders` a todo el mundo, así que cocina caía en una pantalla que no le corresponde.
 */
export default async function AdminOverviewPage() {
  const session = await requireAdminSession();

  if (!canViewAdminOverview(session.user.role)) {
    redirect(resolveAdminLanding(session.user.role));
  }

  return <AdminOverviewClient />;
}
