import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageMenu } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { createModifierGroup } from "@/modules/menu/features/create-modifier-group/create-modifier-group";
import { listAdminModifierGroups } from "@/modules/menu/features/list-admin-modifier-groups/list-admin-modifier-groups";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const optionSchema = z.object({
  name: z.string().min(1),
  priceDelta: z.number().default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

const createModifierGroupSchema = z.object({
  name: z.string().min(1),
  isRequired: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(0).default(1),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(optionSchema).min(1),
});

export async function GET() {
  try {
    await requireAdminSession();

    const repository = new PrismaMenuRepository();
    const result = await listAdminModifierGroups({ repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageMenu(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = createModifierGroupSchema.safeParse(payload);

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
    const result = await createModifierGroup(parsed.data, { repository });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
