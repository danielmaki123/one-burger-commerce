import { NextResponse } from "next/server";

import { canViewOrders } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { loadOrderListContext, listAdminOrderRepositories } from "./order-list-context";
import { buildOrderListFilter, parseOrderListQuery } from "./order-list-query";
import { createErrorResponse } from "@/shared/lib/http/error-response";
import { listAdminOrders } from "@/modules/orders/features/list-admin-orders/list-admin-orders";

/**
 * `GET /api/admin/orders` — el **listado administrativo** de pedidos. Sesión → capacidad
 * (`canViewOrders`) → filtros → alcance por sucursal → caso de uso. La puerta **no** es
 * `canManageOrderOperations`: ésa incluye a cocina —que opera `/admin/kitchen` y no lee montos, PIN ni
 * facturas— y deja afuera al cajero, que es quien localiza el pedido que va a cobrar (`D-014`, `A-66`).
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canViewOrders(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const parsed = parseOrderListQuery(new URL(request.url).searchParams);
    if (!parsed.ok) return parsed.response;

    const { scope, locationScope, timeZone, baseCurrencyCode } = await loadOrderListContext(session.user);

    const result = await listAdminOrders(
      buildOrderListFilter({ query: parsed.query, scope, timeZone, now: new Date() }),
      { ...listAdminOrderRepositories(), baseCurrencyCode },
    );

    // El alcance viaja para que la pantalla no reimplemente la regla: `null` = todas.
    return NextResponse.json({ ...result, meta: { ...result.meta, locationScope } });
  } catch (error) {
    return createErrorResponse(error);
  }
}
