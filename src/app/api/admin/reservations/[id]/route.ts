import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaReservationRepository } from "@/modules/reservations/adapters/prisma-reservation-repository";
import { getAdminReservation } from "@/modules/reservations/features/get-admin-reservation/get-admin-reservation";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession();
    const { id } = await params;

    const repository = new PrismaReservationRepository();
    const result = await getAdminReservation(id, { repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
