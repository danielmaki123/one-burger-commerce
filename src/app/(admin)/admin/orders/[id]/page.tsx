import { redirect } from "next/navigation";

import { resolveAdminLanding } from "@/modules/auth/domain/admin-landing";
import { canViewOrders } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import OrderDetailClient from "./_components/order-detail-client";

export const dynamic = "force-dynamic";

/**
 * `/admin/orders/[id]` — el **detalle** de un pedido.
 *
 * La puerta es la misma que la del listado (`canViewOrders`): cocina no entra y va a su superficie. El
 * **alcance por sucursal** y el **recorte financiero** los aplica la API —que devuelve el
 * `OrderDetailProjection` ya recortado—, así que esta página no decide qué campos se ven: los dibuja. Es la
 * diferencia entre autorizar y ocultar (`A-60`).
 */
export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminSession();

  if (!canViewOrders(session.user.role)) {
    redirect(resolveAdminLanding(session.user.role));
  }

  const { id } = await params;

  return <OrderDetailClient orderId={id} />;
}
