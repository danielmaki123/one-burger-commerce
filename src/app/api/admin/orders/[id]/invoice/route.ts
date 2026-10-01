import { NextResponse } from "next/server";

import { emitOrderInvoice, loadOrderInvoiceState } from "./invoice-composition";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Factura simple (2026-09-18) — el documento del pedido. **No es una factura fiscal**: es el papel que el
 * cliente se lleva. `GET` dice si ya hay una (y si esta sesión puede emitirla); `POST` la emite.
 *
 * `TASK-ORDERS-RUNTIME-5B` (`A-70`) — las dos puertas son **fail-closed** y viven en la composición: sin
 * capacidad financiera no se lee el documento, y sin la capacidad del cobro no se emite. El alcance por
 * sucursal también se comprueba ahí, antes de tocar la factura.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;
    const data = await loadOrderInvoiceState({
      orderId: id,
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    });
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;
    const data = await emitOrderInvoice({
      orderId: id,
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      actorUserId: session.user.id,
      body: await request.json().catch(() => ({})),
    });
    return NextResponse.json(
      { data },
      { status: data.reused ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}
