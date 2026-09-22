import { NextResponse } from "next/server";

import {
  TERMINALS_NO_STORE,
  cashTerminalsErrorResponse,
  getCashTerminalsForRoute,
  saveCashTerminalsForRoute,
} from "./terminals-composition";

export const dynamic = "force-dynamic";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — `GET`/`PUT /api/admin/cash/terminals`, **solo para el dueño**
 * (`canManageCashConfig`): con qué estaciones cuenta la sucursal decide cómo se abre y se cierra cada caja.
 *
 * La puerta, el alcance, el guardado con su firma y el mapeo de errores viven en `terminals-composition.ts`
 * (el handler tiene un tope de 50 líneas).
 */
export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get("locationId")?.trim() ?? "";

    return NextResponse.json(
      { data: await getCashTerminalsForRoute(locationId) },
      { headers: TERMINALS_NO_STORE },
    );
  } catch (error) {
    return cashTerminalsErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json(
      { data: await saveCashTerminalsForRoute(body) },
      { headers: TERMINALS_NO_STORE },
    );
  } catch (error) {
    return cashTerminalsErrorResponse(error);
  }
}
