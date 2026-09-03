import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageCriticalConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaDeliveryZoneRepository } from "@/modules/orders/adapters/prisma-delivery-zone-repository";
import { createDeliveryZone } from "@/modules/orders/features/create-delivery-zone/create-delivery-zone";
import { listAdminDeliveryZones } from "@/modules/orders/features/list-admin-delivery-zones/list-admin-delivery-zones";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const createDeliveryZoneSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  baseFee: z.number().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export async function GET() {
  try {
    await requireAdminSession();

    const repository = new PrismaDeliveryZoneRepository();
    const result = await listAdminDeliveryZones({ repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageCriticalConfig(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = createDeliveryZoneSchema.safeParse(payload);

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
    const result = await createDeliveryZone(parsed.data, { repository });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
