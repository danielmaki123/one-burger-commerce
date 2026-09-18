import { NextResponse } from "next/server";

import { loadHistoryShifts } from "@/app/api/admin/history/cierres/cierres-composition";
import { historyErrorResponse } from "@/app/api/admin/invoices/invoice-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

export const dynamic = "force-dynamic";

/**
 * Punto 2 del roadmap (2026-09-18) — `GET /api/admin/history/cierres`: los cierres de caja del Historial.
 *
 * Es el hermano de `GET /api/admin/cash/shifts`, que devuelve los turnos de **una** sucursal: acá hacen
 * falta las de todo el alcance, porque la sección se mira por sucursal y por cajero a la vez. Solo
 * orquesta: el permiso, el alcance y la lista viven en `loadHistoryShifts`.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);

    const { shifts, locationIds } = await loadHistoryShifts({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      query: searchParams,
    });

    return NextResponse.json(
      { data: shifts, meta: { total: shifts.length, locationIds } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return historyErrorResponse(error);
  }
}
