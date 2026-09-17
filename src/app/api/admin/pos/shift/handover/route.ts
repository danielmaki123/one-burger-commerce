import { NextResponse } from "next/server";

import { requirePosScope } from "@/app/api/admin/pos/pos-scope";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { listPosShiftHandovers, registerPosShiftHandover } from "./handover-composition";
import { parseShiftHandoverPayload } from "./handover-payload";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Tarea 7 del brief (2026-09-17) — el **traspaso de caja entre cajeros** (1.13): la caja no se cierra
 * cuando cambia el cajero, se traspasa. `GET` lista los del turno, `POST` firma uno con el corte X del
 * momento. La puerta es la del mostrador y el esperado lo calcula el servidor: si lo mandara la pantalla,
 * se estaría firmando un número escrito a mano.
 */
export async function GET(request: Request) {
  try {
    const { locationId, searchParams } = await requirePosScope(request);

    const result = await listPosShiftHandovers({
      locationId,
      shiftId: searchParams.get("shiftId"),
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
    });

    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return createErrorResponse(error);
  }
}
