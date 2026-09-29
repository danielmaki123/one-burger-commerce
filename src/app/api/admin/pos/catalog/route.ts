import { NextResponse } from "next/server";

import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { createProductionPosCatalog } from "@/modules/pos/adapters/production-pos-catalog";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * TASK-302 — el catálogo del punto de venta: sesión, permiso (`canUsePOS`: cocina no), alcance por
 * sucursal y el puerto. La vista (productos con el precio del local, agotados incluidos, chips de
 * categoría y `requiresOptions`) la arma el módulo `pos` sobre el **mismo** caso de uso del menú.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const locationId = await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: searchParams.get("locationId") ?? "",
    });

    const view = await createProductionPosCatalog().listCatalog({
      locationId,
      query: searchParams.get("query") ?? "",
    });

    // `A-85` — el contexto monetario y las monedas aceptadas viajan con el catálogo: es la misma pantalla y
    // el mismo momento. La autoridad es `money`; acá sólo se publica.
    const money = await readProductionMoney();

    return NextResponse.json(
      { data: view, money: money.context, acceptedCurrencies: money.currencies.map((c) => c.code) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
