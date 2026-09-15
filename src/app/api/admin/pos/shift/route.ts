import { NextResponse } from "next/server";

import { assertCanUsePos } from "@/app/api/admin/pos/pos-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { resolvePosLocationId } from "@/modules/pos/domain/pos-location";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/** TASK-305b — la caja abierta del local, o `null` si está cerrada. */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    assertCanUsePos(session.user.role);

    const { searchParams } = new URL(request.url);
    const locationId = resolvePosLocationId({
      requested: searchParams.get("locationId") ?? "",
      scope: resolveOrderLocationScope({
        role: session.user.role,
        assignedLocationIds: session.user.locationIds,
      }),
    });

    const { shiftRepository } = await createProductionPosShiftDependencies();
    const result = await getCurrentShift({ locationId }, { shiftRepository });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
