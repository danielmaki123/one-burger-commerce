import { NextResponse } from "next/server";

import { getCashConfig } from "@/modules/cash-config/features/get-cash-config/get-cash-config";

import {
  CASH_CONFIG_NO_STORE,
  cashConfigErrorResponse,
  requireCashConfigScope,
  saveCashConfigForRoute,
} from "./config-composition";

export const dynamic = "force-dynamic";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — `GET`/`PUT /api/admin/cash/config`, **solo para el dueño**
 * (`canManageCashConfig`): cambia las reglas con las que se firma un arqueo, no es operar la caja. La
 * puerta, el alcance, el guardado con su firma y el mapeo de errores viven en `config-composition.ts`.
 */
export async function GET(request: Request) {
  try {
    const locationId = new URL(request.url).searchParams.get("locationId") ?? "";
    const { repository } = await requireCashConfigScope(locationId);
    const data = await getCashConfig({ locationId }, { repository });

    return NextResponse.json({ data }, { headers: CASH_CONFIG_NO_STORE });
  } catch (error) {
    return cashConfigErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { locationId?: string };
    const { session, repository } = await requireCashConfigScope(body.locationId?.trim() ?? "");
    const data = await saveCashConfigForRoute(body, {
      actorUserId: session.user.id,
      repository,
    });

    return NextResponse.json({ data }, { headers: CASH_CONFIG_NO_STORE });
  } catch (error) {
    return cashConfigErrorResponse(error);
  }
}
