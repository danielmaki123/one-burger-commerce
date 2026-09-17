import { NextResponse } from "next/server";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { assertShiftInScope, parseReopenShiftPayload } from "@/app/api/admin/cash/shifts/reopen-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { reopenShift } from "@/modules/orders/features/shift/reopen-shift/reopen-shift";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Bloque 1.10 del roadmap del POS (Fase 2) — reabrir un turno cerrado.
 *
 * Tres guardas: administrar la caja (`requireCashScope`: dueño o manager), que el turno sea de una
 * sucursal dentro del alcance, y un **motivo** escrito. El turno queda abierto y el próximo cierre
 * calcula un arqueo nuevo.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const { reason } = parseReopenShiftPayload(await request.json());
    const locations = await requireCashScope({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    });
    const repository = new PrismaShiftRepository();

    assertShiftInScope(
      await repository.findShiftById(id),
      locations.map((location) => location.id),
    );

    const result = await reopenShift(
      { shiftId: id, userId: session.user.id, reason, strict: true },
      { shiftRepository: repository },
    );

    return NextResponse.json({ data: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
