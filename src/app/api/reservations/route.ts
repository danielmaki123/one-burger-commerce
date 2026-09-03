import { NextResponse } from "next/server";
import { z } from "zod";

import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { PrismaReservationRepository } from "@/modules/reservations/adapters/prisma-reservation-repository";
import { createReservation } from "@/modules/reservations/features/create-reservation/create-reservation";
import { createErrorResponse } from "@/shared/lib/http/error-response";

registerOutboxEventBusHandlers();

const reservationSchema = z.object({
  customerName: z.string().min(1),
  customerWhatsapp: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  partySize: z.number().int().min(1),
  tableId: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = reservationSchema.safeParse(payload);

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
    const result = await createReservation(parsed.data, { repository });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
