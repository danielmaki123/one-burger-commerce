import { NextResponse } from "next/server";

import { requirePosScope } from "@/app/api/admin/pos/pos-scope";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { listPosShiftHandovers, registerPosShiftHandover } from "./handover-composition";
import { parseShiftHandoverPayload } from "./handover-payload";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Tarea 7 del brief (2026-09-17) — el **traspaso de caja** (1.13): `GET` lista y `POST` firma con el corte
 * X del momento (lo calcula el servidor); la respuesta se filtra por rol (AUD-003).
 */
export async function GET(request: Request) {
  try {
    const { session, locationId, searchParams } = await requirePosScope(request);

    const result = await listPosShiftHandovers({
      locationId,
      shiftId: searchParams.get("shiftId"),
      role: session.user.role,
    });

    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = parseShiftHandoverPayload(await request.json().catch(() => ({})));
    const { session, locationId } = await requirePosScope(request, payload.locationId);

    const result = await registerPosShiftHandover({
      ...payload,
      locationId,
      actorUserId: session.user.id,
      actorName: session.user.name,
      role: session.user.role,
    });

    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return createErrorResponse(error);
  }
}
