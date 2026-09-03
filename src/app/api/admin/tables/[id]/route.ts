import { NextResponse } from "next/server";
import { z } from "zod";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { canManageCriticalConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const updateTableSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  locationId: z.string().trim().min(1).max(80).optional(),
});

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
    const parsed = updateTableSchema.safeParse(payload);

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

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: { payload: "At least one field is required" },
          },
        },
        { status: 400 },
      );
    }

    const prisma = getPrismaClient();
    const table = await prisma.table.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        label: true,
        isActive: true,
        capacity: true,
        locationId: true,
        qrToken: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: table });
  } catch (error) {
    return createErrorResponse(error);
  }
}

