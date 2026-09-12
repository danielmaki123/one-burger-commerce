import { NextResponse } from "next/server";

import { promotionSchema, firstFieldErrors } from "@/app/api/admin/promotions/promotion-payload";
import { canManagePromotions } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { deletePromotion } from "@/modules/orders/features/delete-promotion/delete-promotion";
import { updatePromotion } from "@/modules/orders/features/update-promotion/update-promotion";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Una promo concreta (T9c).
 *
 * El PATCH recibe la promo **completa**, que es lo que manda el formulario. No es un
 * merge parcial a propósito: un campo que falta es un error de la pantalla, no un
 * borrado silencioso de lo que el owner ya había configurado.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canManagePromotions(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id } = await params;
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

    const settings = await loadBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });

    const repository = new PrismaOrderRepository();
    const result = await updatePromotion(id, parsed.data, {
      repository,
      timeZone: settings.timezone,
    });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canManagePromotions(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const repository = new PrismaOrderRepository();
    const result = await deletePromotion(id, { repository });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
