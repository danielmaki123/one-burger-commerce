import { NextResponse } from "next/server";

import { PrismaReservationRepository } from "@/modules/reservations/adapters/prisma-reservation-repository";
import { checkAvailability } from "@/modules/reservations/features/check-availability/check-availability";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? "";
    const time = searchParams.get("time") ?? undefined;
    const partySizeParam = searchParams.get("partySize");
    const partySize = partySizeParam ? Number(partySizeParam) : 0;

    const repository = new PrismaReservationRepository();
    const result = await checkAvailability(
      { date, time, partySize },
      { repository },
    );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
