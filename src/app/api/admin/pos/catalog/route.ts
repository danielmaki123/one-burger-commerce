import { NextResponse } from "next/server";

import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosCatalog } from "@/modules/pos/adapters/production-pos-catalog";
import { resolvePosLocationId } from "@/modules/pos/domain/pos-location";
import { searchPosCatalog } from "@/modules/pos/features/search-pos-catalog/search-pos-catalog";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * TASK-302 — el catálogo del punto de venta: sesión, permiso (`canUsePOS`: cocina no), alcance por
 * sucursal y el caso de uso. El catálogo y su composición con Prisma viven en el módulo `pos`.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();

    if (!canUsePOS(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const locationId = resolvePosLocationId({
      requested: searchParams.get("locationId") ?? "",
      scope: resolveOrderLocationScope({
        role: session.user.role,
        assignedLocationIds: session.user.locationIds,
      }),
    });

    const result = await searchPosCatalog({
      catalog: createProductionPosCatalog(),
      locationId,
      query: searchParams.get("query") ?? "",
    });

    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
