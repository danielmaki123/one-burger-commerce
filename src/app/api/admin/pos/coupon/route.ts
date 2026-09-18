import { NextResponse } from "next/server";

import { assertCanUsePos, requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { parsePosCouponPayload } from "@/app/api/admin/pos/coupon/coupon-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createProductionPosCouponDependencies } from "@/modules/pos/adapters/production-pos-coupon";
import { quotePosCoupon } from "@/modules/pos/features/quote-pos-coupon/quote-pos-coupon";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — cuánto descuenta un cupón en la venta en curso.
 *
 * El cajero escribe el código y esta ruta le dice cuánto baja el total **antes** de cobrar (con el mismo
 * cálculo del alta y sin consumir el cupón). Solo orquesta: permiso, payload, local y caso de uso.
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    // Primero el permiso y después el payload: un rol que no cobra no recibe correcciones sobre una venta
    // que no puede hacer.
    assertCanUsePos(session.user.role);

    const { locationId, couponCode, lines } = parsePosCouponPayload(await request.json());
    await requirePosLocation({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
      requested: locationId,
    });

    const result = await quotePosCoupon(
      { couponCode, lines },
      createProductionPosCouponDependencies(),
    );

    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
