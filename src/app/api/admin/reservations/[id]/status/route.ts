import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { PrismaReservationRepository } from "@/modules/reservations/adapters/prisma-reservation-repository";
import { updateReservationStatus } from "@/modules/reservations/features/update-reservation-status/update-reservation-status";
import { createErrorResponse } from "@/shared/lib/http/error-response";

registerOutboxEventBusHandlers();

const statusSchema = z.object({
  status: z.enum([
    "requested",
    "approved",
    "rejected",
    "seated",
    "cancelled",
    "no_show",
  ]),
  reason: z.string().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminSession();

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
              Object.entries(parsed.error.flatten().fieldErrors).map(
                ([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)],
              ),
            ),
          },
        },
        { status: 400 },
      );
    }

    const repository = new PrismaReservationRepository();
    const result = await updateReservationStatus(id, parsed.data, {
      repository,
      admin: session.user,
    });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
