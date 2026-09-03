import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { reviewDeliveryFee } from "@/modules/orders/features/review-delivery-fee/review-delivery-fee";
import { createErrorResponse } from "@/shared/lib/http/error-response";

registerOutboxEventBusHandlers();

const deliveryFeeSchema = z.object({
  deliveryFeeAmount: z.number().min(0),
  deliveryFeeStatus: z.enum(["pending_manual_validation", "confirmed"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canManageOrderOperations(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = deliveryFeeSchema.safeParse(payload);

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
    const result = await reviewDeliveryFee(id, parsed.data, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
