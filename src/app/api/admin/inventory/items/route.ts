import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageCriticalConfig } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaInventoryRepository } from "@/modules/inventory/adapters/prisma-inventory-repository";
import { createInventoryItem } from "@/modules/inventory/features/create-inventory-item/create-inventory-item";
import { listInventoryItems } from "@/modules/inventory/features/list-inventory-items/list-inventory-items";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  category: z.string().min(1),
  currentEstimatedStock: z.number().min(0),
  lowStockThreshold: z.number().min(0),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get("isActive");
    const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
    const lowStockOnly = searchParams.get("lowStockOnly") === "true";
    const search = searchParams.get("search") ?? undefined;

    const repository = new PrismaInventoryRepository();
    const result = await listInventoryItems({ isActive, lowStockOnly, search }, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();

    if (!canManageCriticalConfig(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = itemSchema.safeParse(payload);

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

    const repository = new PrismaInventoryRepository();
    const result = await createInventoryItem({
    ...parsed.data,
    isActive: parsed.data.isActive ?? true,
  }, { repository });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
