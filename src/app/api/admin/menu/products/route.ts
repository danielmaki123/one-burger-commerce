import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageMenu } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { createProduct } from "@/modules/menu/features/create-product/create-product";
import { listAdminProducts } from "@/modules/menu/features/list-admin-products/list-admin-products";
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

const productSchema = z.object({
  categoryId: z.string().cuid(),
  subcategoryId: z.string().cuid().nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  basePrice: z.number().min(0),
  packagingFeeAmount: z.number().min(0).nullable().optional(),
  images: z.array(imageSchema).optional(),
  availability: availabilitySchema.optional(),
  modifierGroups: z.array(z.object({ id: z.string().cuid() })).optional(),
  bundleRules: z.array(bundleRuleSchema).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const subcategoryId = searchParams.get("subcategoryId") ?? undefined;
    const isActiveParam = searchParams.get("isActive");
    const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
    const isAvailableParam = searchParams.get("isAvailable");
    const isAvailable =
      isAvailableParam === "true" ? true : isAvailableParam === "false" ? false : undefined;
    const rawSearch = searchParams.get("search") ?? undefined;
    const search = rawSearch && rawSearch.length > 200 ? rawSearch.slice(0, 200) : rawSearch;

    const repository = new PrismaMenuRepository();
    const result = await listAdminProducts(
      { categoryId, subcategoryId, isActive, isAvailable, search },
      { repository },
    );
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
        {
          error: {
            code: "FORBIDDEN",
            message: "Insufficient permissions",
          },
        },
        { status: 403 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = productSchema.safeParse(payload);

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
    const result = await createProduct(parsed.data, { repository });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
