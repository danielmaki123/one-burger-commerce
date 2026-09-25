import { NextResponse } from "next/server";

import { assertCanUsePos, requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { parseShiftCashPayload } from "@/app/api/admin/pos/shift/shift-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { closePosShiftForRoute } from "../close-shift-composition";
import { filterArqueoForRole } from "../shift-arqueo-role-filter";

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

    const { locationId, terminalId, counts, bankCloses, notes } = parseShiftCashPayload(await request.json());
    await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: locationId,
    });

    const result = await closePosShiftForRoute({
      locationId,
      // Fase 6 del rediseno de Caja: el cierre va sobre la caja de esa terminal.
      terminalId,
      counts,
      bankCloses,
      notes,
      actorUserId: session.user.id,
      actorName: session.user.name,
    });

    // A-45 del backlog: quien cobra no ve el esperado ni la diferencia (`filterArqueoForRole`); el aviso al
    // dueño y la firma del cierre siguen usando el arqueo completo, que se armó arriba.
    return NextResponse.json(filterArqueoForRole(result, session.user.role), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
