import { redirect } from "next/navigation";

import { resolveAdminLanding } from "@/modules/auth/domain/admin-landing";
import { canViewOrders } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import AdminOrdersListClient from "./_components/order-list-client";

export const dynamic = "force-dynamic";

/**
 * `/admin/orders` — el **listado administrativo** de pedidos.
 *
 * La página es un **server component** y su trabajo es la puerta: sin `canViewOrders` no se renderiza el
 * listado. `kitchen` no entra —su superficie es `/admin/kitchen`— y se lo manda **a la suya** con el
 * resolutor único de landing, no a un redirect genérico que lo dejaría en un lugar que no le corresponde
 * (`A-66`). El `cashier` sí entra: es quien tiene que localizar el pedido que va a cobrar (`D-014`).
 *
 * La API vuelve a aplicar la misma puerta: esto es la entrada, no la autorización.
 */
export default async function AdminOrdersPage() {
  const session = await requireAdminSession();

  if (!canViewOrders(session.user.role)) {
    redirect(resolveAdminLanding(session.user.role));
  }

  return <AdminOrdersListClient />;
}
