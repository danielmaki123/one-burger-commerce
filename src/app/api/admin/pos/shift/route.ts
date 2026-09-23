import { NextResponse } from "next/server";

import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { getCurrentShift } from "@/modules/orders/features/shift/get-current-shift";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/** TASK-305b — la caja abierta del local, o `null` si está cerrada. */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const locationId = await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: searchParams.get("locationId") ?? "",
    });

    const { shiftRepository } = await createProductionPosShiftDependencies();
    /**
     * Fase 6 del rediseño de Caja (2026-09-23) — con `terminalId` devuelve la caja **de esa terminal**; sin
     * él, la caja sin terminal (una sola por local). Es lo que permite que dos cajas del mismo local se
     * consulten por separado.
     */
    const result = await getCurrentShift(
      { locationId, terminalId: searchParams.get("terminalId") },
      { shiftRepository },
    );

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
