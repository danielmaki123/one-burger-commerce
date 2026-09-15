import { NextResponse } from "next/server";

import { assertCanUsePos } from "@/app/api/admin/pos/pos-route-helpers";
import { parseShiftCashPayload } from "@/app/api/admin/pos/shift/shift-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { openShift } from "@/modules/orders/features/shift/open-shift";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { resolvePosLocationId } from "@/modules/pos/domain/pos-location";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/** TASK-305b — abrir la caja contando los billetes: el fondo lo deriva el servidor del conteo. */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    assertCanUsePos(session.user.role);

    const { locationId, counts, notes } = parseShiftCashPayload(await request.json());
    resolvePosLocationId({
      requested: locationId,
      scope: resolveOrderLocationScope({
        role: session.user.role,
        assignedLocationIds: session.user.locationIds,
      }),
    });

    const result = await openShift(
      { locationId, userId: session.user.id, openingCounts: counts, notes },
      await createProductionPosShiftDependencies(),
    );

    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
