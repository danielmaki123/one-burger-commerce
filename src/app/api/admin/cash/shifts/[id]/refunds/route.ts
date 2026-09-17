import { NextResponse } from "next/server";

import { requireCashShiftId } from "@/app/api/admin/cash/cash-route-helpers";
import { canRefund } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaRefundRepository } from "@/modules/orders/adapters/prisma-refund-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { requestRefund } from "@/modules/orders/features/refund/request-refund/request-refund";
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
    const result = await requestRefund(
      {
        ...payload,
        requestedByUserId: session.user.id,
        canApprove: canRefund(session.user.role),
        locationId,
      },
      {
        paymentRepository: new PrismaPaymentRepository(),
        refundRepository: new PrismaRefundRepository(),
        shiftRepository: new PrismaShiftRepository(),
      },
    );
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
