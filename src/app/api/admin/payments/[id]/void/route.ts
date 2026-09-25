import { NextResponse } from "next/server";

import { parseVoidPaymentPayload } from "@/app/api/admin/payments/void-payment-payload";
import { voidPaymentForRoute } from "@/app/api/admin/payments/void-payment-composition";
import { canVoidPayment } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * TASK-AUD-059 — `POST /api/admin/payments/[id]/void`: **anular un cobro** (alcance remanente de A-15).
 *
 * El cobro se registró mal —duplicado, con el monto o el medio equivocados— y se invalida: la fila no se
 * borra, queda marcada con cuándo, quién y por qué y deja de contar para el arqueo, para el saldo del
 * pedido y para la conciliación. Es del **dueño** (`canVoidPayment`) y el motivo es obligatorio; el caso
 * de uso vuelve a comprobar el permiso y rechaza la segunda anulación y el cobro con devoluciones vivas.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();

    // La puerta se corta antes de abrir la transacción: el caso de uso la vuelve a aplicar por dentro.
    if (!canVoidPayment(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { id } = await context.params;
    const payload = parseVoidPaymentPayload(await request.json().catch(() => ({})));

    const result = await voidPaymentForRoute({
      paymentId: id,
      role: session.user.role,
      actorUserId: session.user.id,
      reason: payload.reason,
    });

    return NextResponse.json({ data: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
