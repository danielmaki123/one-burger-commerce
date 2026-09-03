import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { listAdminOrders } from "@/modules/orders/features/list-admin-orders/list-admin-orders";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const querySchema = z.object({
  type: z.enum(["delivery", "pickup", "table"]).optional(),
  status: z
    .enum([
      "new",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "closed",
      "ready_for_pickup",
      "picked_up",
      "accepted",
      "served",
      "cancelled",
    ])
    .optional(),
  dateFrom: z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: "Invalid date",
    }),
  dateTo: z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: "Invalid date",
    }),
});

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageOrderOperations(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      type: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
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

    const repository = new PrismaOrderRepository();
    const result = await listAdminOrders(parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
