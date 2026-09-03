import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageInventoryOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaInventoryRepository } from "@/modules/inventory/adapters/prisma-inventory-repository";
import { createInventoryReceive } from "@/modules/inventory/features/create-inventory-receive/create-inventory-receive";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const receiveSchema = z.object({
  inventoryItemId: z.string().min(1),
  receivedQuantity: z.number().min(0),
  notes: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();

    if (!canManageInventoryOperations(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = receiveSchema.safeParse(payload);

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
    const idempotencyKey = request.headers.get("x-idempotency-key") ?? undefined;
    const result = await createInventoryReceive(
      {
        ...parsed.data,
        receivedByUserId: session.user.id,
      },
      { repository, idempotencyKey },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
