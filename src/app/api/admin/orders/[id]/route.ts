import { NextResponse } from "next/server";

import { canViewOrders } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { loadOrderDetailForSession } from "./order-detail-composition";

/**
 * `GET /api/admin/orders/[id]` — el **detalle** de un pedido.
 *
 * Dos puertas, y las dos en el servidor:
 *
 * 1. **`canViewOrders`** (`D-014`): cocina no entra —su superficie es `/admin/kitchen`— y el cajero sí, que
 *    es quien necesita revisar el pedido que va a cobrar.
 * 2. **El alcance por sucursal**: un pedido de otro local no se abre ni por URL directa. Se comprueba
 *    dentro de la composición, **antes** de proyectar.
 *
 * El recorte financiero tampoco es una decisión de esta ruta: lo aplica la proyección según la capacidad
 * del rol (`canViewOrderFinancials`), y por eso un rol sin ella no recibe un solo campo de dinero (`A-60`).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canViewOrders(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { id } = await params;
    const data = await loadOrderDetailForSession({
      orderId: id,
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return createErrorResponse(error);
  }
}
