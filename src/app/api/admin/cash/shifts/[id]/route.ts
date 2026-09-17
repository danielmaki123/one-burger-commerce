import { NextResponse } from "next/server";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Bloque 1.4 del roadmap del POS (Fase 2) — el detalle de un cierre.
 *
 * Dos preguntas antes de devolver nada: el rol tiene que administrar la caja y el turno tiene que ser
 * de un local **dentro de su alcance**. Si no, 404 y no 403: un id de otro local no debería confirmar
 * que existe.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;

    const locations = await requireCashScope({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    });

    const shift = await new PrismaShiftRepository().findShiftById(id);

    if (!shift || !locations.some((location) => location.id === shift.locationId)) {
      throw new ShiftError(404, "NOT_FOUND", "No encontramos ese cierre de caja.");
    }

    return NextResponse.json({ data: shift }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
