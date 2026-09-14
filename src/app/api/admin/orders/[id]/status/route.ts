import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { updateOrderStatus } from "@/modules/orders/features/update-order-status/update-order-status";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { assertOrderInScope } from "../../order-scope";

registerOutboxEventBusHandlers();

const statusSchema = z.object({
  status: z.enum([
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
  ]),
  note: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canManageOrderOperations(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = statusSchema.safeParse(payload);

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

    if (parsed.data.status === "cancelled" && !parsed.data.note?.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            fields: {
              note: "Required when status is cancelled",
            },
          },
        },
        { status: 422 },
      );
    }

    const repository = new PrismaOrderRepository();

    // A: el alcance se comprueba **antes** de mutar; un pedido de otra sucursal no se toca.
    const existing = await repository.findOrderById(id);
    if (!existing) {
      throw new OrderError(404, "NOT_FOUND", "Order not found");
    }

    assertOrderInScope(
      resolveOrderLocationScope({
        role: session.user.role,
        assignedLocationIds: session.user.locationIds,
      }),
      existing.locationId,
    );

    // B5: quién lo cambió, para el historial. Con cuentas compartidas, "quién aceptó esto" es la
    // pregunta que se hace después, cuando algo sale mal.
    const result = await updateOrderStatus(
      id,
      { ...parsed.data, changedByUserId: session.user.id },
      { repository },
    );
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
