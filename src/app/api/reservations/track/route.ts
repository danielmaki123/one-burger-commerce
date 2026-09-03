import { NextResponse } from "next/server";
import { z } from "zod";

import { PrismaReservationRepository } from "@/modules/reservations/adapters/prisma-reservation-repository";
import { trackReservation } from "@/modules/reservations/features/track-reservation/track-reservation";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const reservationTrackSchema = z.object({
  reservationNumber: z.string().min(1),
  reservationLookupToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const parsed = reservationTrackSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid payload",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(
                ([key, value]) => [key, Array.isArray(value) ? value[0] : String(value)],
              ),
            ),
          },
        },
        { status: 400 },
      );
    }

    const repository = new PrismaReservationRepository();
    const result = await trackReservation(parsed.data, { repository });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
