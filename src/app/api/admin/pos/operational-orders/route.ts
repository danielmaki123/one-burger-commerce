import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { loadPosOperationalFeed } from "./operational-orders-composition";

export const dynamic = "force-dynamic";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §8, §9, §10, §12) — **el feed operacional del POS**.
 *
 * Una sola respuesta con el feed mínimo (`PosOperationalOrdersProjection`) y su **resumen calculado en el
 * servidor** sobre el conjunto operacional completo del local. No hay cuatro endpoints de KPI ni cuatro
 * requests que React agregue (brief §10): la banda del POS dibuja lo que el servidor produjo.
 *
 * El alcance por sucursal y el permiso los aplica la composición (`requirePosLocation`); acá sólo se arma la
 * respuesta.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);

    const feed = await loadPosOperationalFeed({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requestedLocationId: searchParams.get("locationId") ?? "",
    });

    return NextResponse.json({ data: feed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
