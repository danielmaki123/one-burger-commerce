import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageMenu } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { getAdminModifierGroup } from "@/modules/menu/features/get-admin-modifier-group/get-admin-modifier-group";
import { updateModifierGroup } from "@/modules/menu/features/update-modifier-group/update-modifier-group";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  priceDelta: z.number().default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const updateModifierGroupSchema = z.object({
  name: z.string().min(1).optional(),
  isRequired: z.boolean().optional(),
  minSelections: z.number().int().min(0).optional(),
  maxSelections: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  options: z.array(optionSchema).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const repository = new PrismaMenuRepository();
    const result = await getAdminModifierGroup(id, { repository });
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
    if (!canManageMenu(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = updateModifierGroupSchema.safeParse(payload);

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

    const repository = new PrismaMenuRepository();
    const result = await updateModifierGroup(id, parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
