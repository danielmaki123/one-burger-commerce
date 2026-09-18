import { NextResponse } from "next/server";

import { assertCanDiscountPosSale, assertCanUsePos, requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { parsePosSalePayload, toPosSaleResponse } from "@/app/api/admin/pos/sale/sale-payload";
import { auditManualDiscount } from "@/app/api/admin/pos/sale/pos-sale-audit";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createProductionPosSaleDependencies } from "@/modules/pos/adapters/production-pos-sale";
import { registerPosSale } from "@/modules/pos/features/register-pos-sale/register-pos-sale";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/** TASK-303b — cobrar una venta de mostrador (tareas 9.6 y 9.7: cupón y descuento manual). Solo orquesta. */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    // Permiso antes que payload: quien no cobra no recibe correcciones sobre una venta que no puede hacer.
    assertCanUsePos(session.user.role);

    const { input, locationId } = parsePosSalePayload(await request.json());
    await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: locationId,
    });
    // Tarea 9.7: descontar a mano necesita permiso propio, y se comprueba antes de crear nada.
    assertCanDiscountPosSale(session.user.role, input.manualDiscount);

    const result = await registerPosSale(input, await createProductionPosSaleDependencies());
    await auditManualDiscount({
      actorUserId: session.user.id,
      orderId: result.order.id,
      reused: result.reused,
      manualDiscount: input.manualDiscount,
    });

    // Tarea 11 del brief: 201 con la venta nueva y **200 cuando el servidor reconoció el intento** (mismo
    // UUID): el mostrador no vuelve a cobrar y lo dice.
    return NextResponse.json(
      { data: toPosSaleResponse(result) },
      { status: result.reused ? 200 : 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
