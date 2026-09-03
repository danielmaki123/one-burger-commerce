import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageMenu } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { getAdminProduct } from "@/modules/menu/features/get-admin-product/get-admin-product";
import { updateProduct } from "@/modules/menu/features/update-product/update-product";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const imageSchema = z.object({
  url: z.string().min(1).max(2000),
  alt: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPrimary: z.boolean().optional(),
});

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  isActive: z.boolean(),
});

const bundleRuleSchema = z.object({
  name: z.string().min(1),
  ruleType: z.string().min(1),
  config: z.unknown().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const idSchema = z.string().cuid();

const updateProductSchema = z.object({
  categoryId: z.string().cuid().optional(),
  subcategoryId: z.string().cuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  basePrice: z.number().min(0).optional(),
  packagingFeeAmount: z.number().min(0).nullable().optional(),
  images: z.array(imageSchema).optional(),
  availability: availabilitySchema.optional(),
  modifierGroups: z.array(z.object({ id: z.string().cuid() })).optional(),
  bundleRules: z.array(bundleRuleSchema).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const idResult = idSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid product id" } },
        { status: 400 },
      );
    }
    const repository = new PrismaMenuRepository();
    const result = await getAdminProduct(id, { repository });
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
        {
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          },
        },
        { status: 403 },
      );
    }

    const { id } = await params;
    const idResult = idSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid product id" } },
        { status: 400 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = updateProductSchema.safeParse(payload);

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
    const result = await updateProduct(id, parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
