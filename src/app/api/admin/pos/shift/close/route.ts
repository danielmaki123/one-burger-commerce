import { NextResponse } from "next/server";

import { assertCanUsePos, requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { parseShiftCashPayload } from "@/app/api/admin/pos/shift/shift-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { closePosShiftForRoute } from "../close-shift-composition";

export const dynamic = "force-dynamic";

/**
 * TASK-305b + decisión del owner (2026-09-17) — cerrar la caja contando lo que hay: el esperado lo calcula
 * el servidor (solo efectivo, dólares convertidos, vuelto descontado), la respuesta lo trae **por moneda** y
 * cada cierre avisa al grupo del dueño. El cierre, su firma en el log y el mensaje viven en
 * `close-shift-composition.ts` (el handler tiene un tope de 50 líneas).
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    assertCanUsePos(session.user.role);

    const { locationId, counts, bankCloses, notes } = parseShiftCashPayload(await request.json());
    await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: locationId,
    });

    const result = await closePosShiftForRoute({
      locationId,
      counts,
      bankCloses,
      notes,
      actorUserId: session.user.id,
      actorName: session.user.name,
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
