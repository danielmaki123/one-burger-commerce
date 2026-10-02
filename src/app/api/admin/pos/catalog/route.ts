import { NextResponse } from "next/server";

import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { loadPosCatalogPayload } from "./pos-catalog-composition";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * TASK-302 — el catálogo del punto de venta: sesión, permiso (`canUsePOS`: cocina no), alcance por
 * sucursal y el puerto. La vista (productos con el precio del local, agotados incluidos, chips de
 * categoría y `requiresOptions`) la arma el módulo `pos` sobre el **mismo** caso de uso del menú.
 *
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §37, §40) — además publica lo que la pantalla necesita para cobrar
 * con la configuración real: el contexto de `money`, las monedas aceptadas y los **medios configurados del
 * local**. La composición vive en `pos-catalog-composition.ts` (tope de 50 líneas del handler).
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

    const payload = await loadPosCatalogPayload({
      locationId,
      query: searchParams.get("query") ?? "",
    });

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
