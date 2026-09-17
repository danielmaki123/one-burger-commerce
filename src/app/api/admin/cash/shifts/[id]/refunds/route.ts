import { NextResponse } from "next/server";

import { requireCashShiftId } from "@/app/api/admin/cash/cash-route-helpers";
import { requestShiftRefund } from "@/app/api/admin/cash/shifts/refund-request-composition";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { parseRefundRequestPayload } from "@/app/api/admin/approvals/refunds-payload";

/**
 * Bloque 3.3 del roadmap del POS (Fase 2) — pedir la devolución de un cobro.
 *
 * Una devolución **total** es el «void» del cobro (anular la venta antes del cierre) y una **parcial**
 * devuelve una parte. El medio y la moneda salen del **cobro original**: devolver en efectivo algo que
 * se cobró con tarjeta no sale del cajón.
 *
 * Quien administra la caja la deja aprobada de una; quien no, la deja **pendiente** para que la firme
 * otro (nadie aprueba su propia devolución). El arqueo la descuenta recién cuando está aprobada.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const payload = parseRefundRequestPayload(await request.json());
    const locationId = await requireCashShiftId({ id });
    const data = await requestShiftRefund({
      payload,
      actorUserId: session.user.id,
      locationId,
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
