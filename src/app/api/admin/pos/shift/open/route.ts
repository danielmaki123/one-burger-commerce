import { NextResponse } from "next/server";

import { shiftOpenAudit } from "@/app/api/admin/audit-action-helpers";
import { assertCanUsePos, requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { parseShiftCashPayload } from "@/app/api/admin/pos/shift/shift-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { openShift } from "@/modules/orders/features/shift/open-shift";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/** TASK-305b — abrir la caja contando los billetes: el fondo lo deriva el servidor del conteo. */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    assertCanUsePos(session.user.role);

    const { locationId, terminalId, counts, notes } = parseShiftCashPayload(await request.json());
    await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: locationId,
    });

    // La terminal (Fase 6) la valida el caso de uso contra el catálogo activo del local;
    // la config del conteo entra por las dependencias y es la misma que dibuja la pantalla (Fase 2).
    const result = await openShift(
      { locationId, terminalId, userId: session.user.id, openingCounts: counts, notes },
      await createProductionPosShiftDependencies({ locationId }),
    );

    // Bloque 13.1: abrir la caja queda firmado con quién la abrió y con qué fondo.
    await shiftOpenAudit({
      actorUserId: session.user.id,
      shiftId: result.data.id,
      locationId,
      openingAmount: result.data.openingAmount,
    });

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
