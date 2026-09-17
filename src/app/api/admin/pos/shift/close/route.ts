import { NextResponse } from "next/server";

import { shiftCloseAudit } from "@/app/api/admin/audit-action-helpers";
import { assertCanUsePos, requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { parseShiftCashPayload } from "@/app/api/admin/pos/shift/shift-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { closePosShift } from "@/modules/pos/features/close-pos-shift/close-pos-shift";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * TASK-305b — cerrar la caja contando lo que hay: el esperado lo calcula el servidor (solo efectivo,
 * dólares convertidos, vuelto descontado) y la respuesta lo trae **por moneda**.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    assertCanUsePos(session.user.role);

    const { locationId, counts, notes } = parseShiftCashPayload(await request.json());
    await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: locationId,
    });

    const result = await closePosShift(
      { locationId, counts, notes },
      await createProductionPosShiftDependencies(),
    );

    // Bloque 13.1: el cierre queda firmado con lo contado, el esperado y la diferencia.
    await shiftCloseAudit({
      actorUserId: session.user.id,
      locationId,
      shiftId: result.data?.id,
      counted: result.data?.closingAmount ?? null,
      expected: result.data?.expectedAmount ?? null,
      difference: result.data?.difference ?? null,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
