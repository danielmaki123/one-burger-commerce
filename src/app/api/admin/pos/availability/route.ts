import { NextResponse } from "next/server";

import { assertCanUsePos } from "@/app/api/admin/pos/pos-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { pickPosLocations } from "@/modules/pos/domain/pos-locations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * TASK-308 — ¿este admin tiene mostrador en algún local?
 *
 * Es la única pregunta que contesta: la navegación no muestra «Caja» si no hay ningún local del staff
 * con el punto de venta prendido. No devuelve la lista de locales a propósito —para eso está el
 * catálogo del POS, que trae los precios del local—: acá solo se decide si la entrada existe.
 */
export async function GET() {
  try {
    const session = await requireAdminSession();
    assertCanUsePos(session.user.role);

    const { repository } = createProductionPosLocationDependencies();
    const locations = pickPosLocations(
      await repository.listLocations(),
      resolveOrderLocationScope({
        role: session.user.role,
        assignedLocationIds: session.user.locationIds,
      }),
    );

    return NextResponse.json(
      { data: { available: locations.length > 0 } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
