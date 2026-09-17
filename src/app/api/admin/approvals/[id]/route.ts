import { NextResponse } from "next/server";

import { refundReviewAudit } from "@/app/api/admin/audit-action-helpers";
import { canRefund } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { reviewRefund } from "@/modules/orders/features/refund/review-refund/review-refund";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { parseRefundReviewPayload } from "../refunds-payload";

/**
 * Bloque 3.2 del roadmap del POS (Fase 2) — aprobar o rechazar una devolución.
 *
 * Solo quien administra la caja resuelve, y el caso de uso exige que siga **pendiente**: resolverla dos
 * veces cambiaría el arqueo de un turno que ya la descontó (o no). Bloque 13.1: queda firmada.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canRefund(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { id } = await params;
    const payload = parseRefundReviewPayload(await request.json());
    const result = await reviewRefund(
      {
        refundId: id,
        decision: payload.decision,
        reviewedByUserId: session.user.id,
        note: payload.note,
      },
      { refundRepository: new PrismaRefundRepository() },
    );

    // Bloque 13.1: aprobar y rechazar son acciones distintas, cada una con su asiento.
    await refundReviewAudit({ actorUserId: session.user.id, refundId: id, ...payload });

    return NextResponse.json({ data: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
