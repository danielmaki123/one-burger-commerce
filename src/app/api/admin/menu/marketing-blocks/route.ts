import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageMenu } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { createMarketingBlock } from "@/modules/menu/features/create-marketing-block/create-marketing-block";
import { listAdminMarketingBlocks } from "@/modules/menu/features/list-admin-marketing-blocks/list-admin-marketing-blocks";
import { createErrorResponse } from "@/shared/lib/http/error-response";

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return parsed;
}

const createMarketingBlockSchema = z.object({
  type: z.enum(["promo", "event", "combo", "featured", "info"]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  ctaLabel: z.string().optional().nullable(),
  ctaType: z.enum(["none", "product", "category", "url"]),
  ctaTarget: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  startsAt: z.unknown().optional(),
  endsAt: z.unknown().optional(),
});

export async function GET() {
  try {
    await requireAdminSession();
    const repository = new PrismaMenuRepository();
    const result = await listAdminMarketingBlocks({ repository });
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
    const parsed = createMarketingBlockSchema.safeParse(payload);

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

    let startsAt: Date | null | undefined;
    let endsAt: Date | null | undefined;
    try {
      startsAt = parseOptionalDate(parsed.data.startsAt);
      endsAt = parseOptionalDate(parsed.data.endsAt);
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: {
              startsAt: "Invalid date",
              endsAt: "Invalid date",
            },
          },
        },
        { status: 400 },
      );
    }

    const repository = new PrismaMenuRepository();
    const result = await createMarketingBlock(
      {
        ...parsed.data,
        startsAt,
        endsAt,
      },
      { repository },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
