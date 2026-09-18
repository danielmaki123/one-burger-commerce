import { NextResponse } from "next/server";

import { historyErrorResponse } from "@/app/api/admin/invoices/invoice-route-helpers";
import { loadInvoicesHistory } from "@/app/api/admin/invoices/invoices-history-composition";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

export const dynamic = "force-dynamic";

/**
 * Punto 2 del roadmap (2026-09-18) — `GET /api/admin/invoices`: las facturas del Historial.
 *
 * Solo orquesta: la composición (`loadInvoicesHistory`) resuelve el permiso (`canViewHistory`: el cajero
 * no audita, cocina no maneja plata), el alcance por sucursal y los filtros de la barra.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);

    const { invoices, locationIds } = await loadInvoicesHistory({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      query: searchParams,
    });

    return NextResponse.json(
      { data: invoices, meta: { total: invoices.length, locationIds } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return historyErrorResponse(error);
  }
}
