import { NextResponse } from "next/server";

import {
  BANKS_NO_STORE,
  banksErrorResponse,
  getBankCatalogForRoute,
  requireBankCatalogScope,
  saveBankCatalogForRoute,
} from "./banks-composition";

export const dynamic = "force-dynamic";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — `GET`/`PUT /api/admin/cash/banks`, **solo para el dueño**
 * (`canManageCashConfig`): con qué bancos liquida cada sucursal decide contra qué se cuadra el lote de la
 * terminal, así que no es operar la caja.
 *
 * La puerta, el alcance, el guardado con su firma y el mapeo de errores viven en `banks-composition.ts`
 * (el handler tiene un tope de 50 líneas).
 */
export async function GET() {
  try {
    await requireBankCatalogScope();

    return NextResponse.json({ data: await getBankCatalogForRoute() }, { headers: BANKS_NO_STORE });
  } catch (error) {
    return banksErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const scope = await requireBankCatalogScope();
    const body = await request.json().catch(() => ({}));
    const data = await saveBankCatalogForRoute(body, {
      actorUserId: scope.session.user.id,
      allowedLocationIds: scope.allowedLocationIds,
    });

    return NextResponse.json({ data }, { headers: BANKS_NO_STORE });
  } catch (error) {
    return banksErrorResponse(error);
  }
}
