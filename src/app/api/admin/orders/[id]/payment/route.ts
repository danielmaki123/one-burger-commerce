import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { registerOrderPaymentForRoute } from "./payment-composition";

export const dynamic = "force-dynamic";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — `POST /api/admin/orders/[id]/payment`: registra el
 * cobro de un pedido que **ya existe** (el del menú público, que se paga al retirar).
 *
 * Es lo que faltaba para que ese pedido pueda facturarse: la factura se emite sobre lo que se cobró. Permiso
 * y alcance del POS (cajero, manager y owner) y la composición en `payment-composition.ts` (el handler tiene
 * un tope de 50 líneas).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;

    const result = await registerOrderPaymentForRoute({
      orderId: id,
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      body: await request.json().catch(() => ({})),
    });

    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
