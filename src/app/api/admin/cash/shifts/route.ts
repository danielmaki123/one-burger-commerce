import { NextResponse } from "next/server";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { listLocationShifts } from "@/modules/orders/features/shift/list-location-shifts/list-location-shifts";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { resolveCashLocationId } from "@/modules/pos/domain/cash-locations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Bloque 1.3 del roadmap del POS (Fase 2) — el historial de cierres de una sucursal.
 *
 * Resuelve la misma puerta que la pantalla (`requireCashScope`: administrar la caja y estar dentro del
 * alcance) y devuelve los turnos tal como se guardaron. No recalcula el arqueo: el `expectedAmount`
 * quedó congelado al cerrar.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);

    const locations = await requireCashScope({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    });

    const locationId = resolveCashLocationId(locations, searchParams.get("locationId"));

    if (!locationId) {
      return NextResponse.json(
        { data: [], meta: { locationId: null, total: 0, openCount: 0, closedCount: 0 } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = await listLocationShifts(
      { locationId },
      { shiftRepository: new PrismaShiftRepository() },
    );

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
