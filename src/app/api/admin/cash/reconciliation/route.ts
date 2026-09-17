import { NextResponse } from "next/server";

import { cashErrorResponse, requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import { reconciliationForRoute } from "./reconciliation-composition";
import { parseReconciliationDate } from "./reconciliation-payload";

export const dynamic = "force-dynamic";

/**
 * Tarea 10 del brief (2026-09-17) — la **conciliación de tarjeta y transferencia** (11.1/11.2).
 *
 * Devuelve los cobros de esas dos vías en el día del negocio y su resumen, para que la pantalla los
 * muestre y baje el CSV con el que el owner compara contra el lote de la terminal y el extracto del banco.
 * La puerta es la de auditar la caja (`requireCashScope`: dueño o manager, dentro de su alcance).
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);

    const locations = await requireCashScope({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    });

    const result = await reconciliationForRoute({
      locations,
      requestedLocationId: searchParams.get("locationId"),
      requestedDate: parseReconciliationDate(searchParams.get("date")),
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return cashErrorResponse(error);
  }
}
