import { NextResponse } from "next/server";

import { promotionSchema, firstFieldErrors } from "@/app/api/admin/promotions/promotion-payload";
import { canManagePromotions } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { createPromotion } from "@/modules/orders/features/create-promotion/create-promotion";
import { listPromotions } from "@/modules/orders/features/list-promotions/list-promotions";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Promos (T9c).
 *
 * Zod valida la forma (tipos, rangos obvios) y `promotion-rules` valida el negocio
 * (qué combinación de campos tiene sentido). Los dos devuelven errores por campo:
 * el formulario del admin los muestra debajo del input que corresponde.
 */

export async function GET() {
  try {
    await requireAdminSession();

    const repository = new PrismaOrderRepository();
    const result = await listPromotions({ repository });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManagePromotions(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = promotionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: firstFieldErrors(parsed.error.flatten().fieldErrors),
          },
        },
        { status: 400 },
      );
    }

    // La zona del negocio resuelve qué significa "vence el 31/12" (final de ese día
    // en el local, no a las 00:00 UTC).
    const settings = await loadBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });

    const repository = new PrismaOrderRepository();
    const result = await createPromotion(parsed.data, { repository, timeZone: settings.timezone });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
