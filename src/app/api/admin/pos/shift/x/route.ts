import { NextResponse } from "next/server";

import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { previewOpenShiftArqueo } from "./shift-x-composition";
import { filterArqueoForRole } from "../shift-arqueo-role-filter";

export const dynamic = "force-dynamic";

/**
 * Tarea 7 del brief (2026-09-17) — el **corte X** del local (1.12): cómo va la caja **ahora**, sin
 * cerrarla. Es una lectura: no cierra el turno ni toca nada, así que la puerta es la del mostrador.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const locationId = await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: searchParams.get("locationId") ?? "",
    });

    const result = await previewOpenShiftArqueo({ locationId, now: new Date() });

    // A-45 del backlog: el cajero cuenta a ciegas también por API (el filtro se aplica acá y no en el caso
    // de uso porque el traspaso de caja firma con el arqueo completo).
    return NextResponse.json(filterArqueoForRole(result, session.user.role), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
