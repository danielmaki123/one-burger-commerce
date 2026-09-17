import { NextResponse } from "next/server";

import { assertCanUsePos, requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { parseShiftCashPayload } from "@/app/api/admin/pos/shift/shift-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { closePosShiftForRoute } from "../close-shift-composition";

export const dynamic = "force-dynamic";

/**
 * TASK-305b — cerrar la caja contando lo que hay: el esperado lo calcula el servidor (solo efectivo,
 * dólares convertidos, vuelto descontado) y la respuesta lo trae **por moneda**.
 *
 * El cierre, su firma en el log y el aviso al dueño si la diferencia supera el umbral viven en
 * `close-shift-composition.ts` (el handler tiene un tope de 50 líneas).
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

    const result = await closePosShiftForRoute({
      locationId,
      counts,
      notes,
      actorUserId: session.user.id,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
