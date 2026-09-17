import { NextResponse } from "next/server";

import { canApproveRefund } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Bloque 3.6 del roadmap del POS (Fase 2) — la cola de aprobaciones.
 *
 * Devuelve las devoluciones **pendientes** (de la más vieja a la más nueva, porque es una cola de
 * trabajo) y solo para quien puede **firmarlas**: desde la tarea 9 del brief (2026-09-17) eso es el
 * dueño (`canApproveRefund`). La resolución va por `POST /api/admin/approvals/[id]`.
 */
export async function GET() {
  try {
    const session = await requireAdminSession();
    if (!canApproveRefund(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const data = await new PrismaRefundRepository().listPending();

    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
