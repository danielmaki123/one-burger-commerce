import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaInventoryRepository } from "@/modules/inventory/adapters/prisma-inventory-repository";
import { listInventoryMovements } from "@/modules/inventory/features/list-inventory-movements/list-inventory-movements";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const querySchema = z.object({
  inventoryItemId: z.string().min(1).optional(),
  type: z.enum(["count", "receive", "waste"]).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      inventoryItemId: searchParams.get("inventoryItemId") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query params",
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
    const result = await listInventoryMovements(parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
