import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaReservationRepository } from "@/modules/reservations/adapters/prisma-reservation-repository";
import { listAdminReservations } from "@/modules/reservations/features/list-admin-reservations/list-admin-reservations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const date = searchParams.get("date") ?? undefined;

    const repository = new PrismaReservationRepository();
    const result = await listAdminReservations(
      { status, date },
      { repository },
    );
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
