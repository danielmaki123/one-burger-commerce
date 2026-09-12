import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { setLocationProduct } from "@/modules/locations/features/set-location-product/set-location-product";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Precio y disponibilidad de un producto en un local (T8 fase 4).
 *
 * Es configuración del negocio (el owner decide si un plato se vende en una sucursal y a qué
 * precio), así que va con el mismo permiso que `/admin/settings`. `priceOverride: null` con
 * el producto vendible y disponible significa "volver al precio base": el caso de uso borra
 * la excepción en vez de guardar el precio del negocio copiado.
 */
const locationProductSchema = z.object({
  priceOverride: z.number().nullable().default(null),
  isAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  try {
    const session = await requireAdminSession();
    if (!canManageBusinessSettings(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id, productId } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = locationProductSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
                key,
                Array.isArray(value) ? value[0] : String(value),
              ]),
            ),
          },
        },
        { status: 400 },
      );
    }

    const result = await setLocationProduct(id, productId, parsed.data, {
      locationRepository: new PrismaLocationRepository(),
      menuRepository: new PrismaMenuRepository(),
    });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
