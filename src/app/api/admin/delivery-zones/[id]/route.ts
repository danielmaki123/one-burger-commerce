import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageCriticalConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaDeliveryZoneRepository } from "@/modules/orders/adapters/prisma-delivery-zone-repository";
import { getAdminDeliveryZone } from "@/modules/orders/features/get-admin-delivery-zone/get-admin-delivery-zone";
import { updateDeliveryZone } from "@/modules/orders/features/update-delivery-zone/update-delivery-zone";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const updateDeliveryZoneSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  baseFee: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const repository = new PrismaDeliveryZoneRepository();
    const result = await getAdminDeliveryZone(id, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession();
    if (!canManageCriticalConfig(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = updateDeliveryZoneSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
                k,
                Array.isArray(v) ? v[0] : String(v),
              ]),
            ),
          },
        },
        { status: 400 },
      );
    }

    const repository = new PrismaDeliveryZoneRepository();
    const result = await updateDeliveryZone(id, parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
