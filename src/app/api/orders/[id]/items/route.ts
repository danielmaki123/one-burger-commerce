import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { addTableOrderItems } from "@/modules/orders/features/add-table-order-items/add-table-order-items";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  modifierOptionIds: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

const itemsSchema = z.object({
  items: z.array(itemSchema).min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Table ordering is outside the pickup MVP scope, so this mutation stays
    // behind an authenticated staff session instead of being publicly writable.
    const session = await requireAdminSession();

    if (!canManageOrderOperations(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = itemsSchema.safeParse(payload);

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

    const repository = new PrismaOrderRepository();
    const result = await addTableOrderItems(id, parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
