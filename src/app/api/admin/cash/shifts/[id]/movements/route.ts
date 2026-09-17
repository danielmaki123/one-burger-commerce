import { NextResponse } from "next/server";

import { cashErrorResponse, requireCashShiftId } from "@/app/api/admin/cash/cash-route-helpers";
import { parseCashMovementPayload } from "@/app/api/admin/cash/shifts/movements-payload";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaCashMovementRepository } from "@/modules/orders/adapters/prisma-cash-movement-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { registerCashMovement } from "@/modules/orders/features/cash-movement/register-cash-movement/register-cash-movement";

export const dynamic = "force-dynamic";
/**
 * Bloque 2.3 del roadmap del POS (Fase 2) — los movimientos de un turno.
 *
 * `GET` devuelve su historial. `POST` registra un retiro o un ingreso **solo sobre la caja abierta**
 * (lo exige el caso de uso): un movimiento sobre un turno cerrado cambiaría un arqueo ya firmado.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const shiftId = await requireCashShiftId(await params);
    const data = await new PrismaCashMovementRepository().listByShift(shiftId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return cashErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const payload = parseCashMovementPayload(await request.json());
    await requireCashShiftId({ id });

    const result = await registerCashMovement(
      { ...payload, shiftId: id, userId: session.user.id },
      {
        shiftRepository: new PrismaShiftRepository(),
        cashMovementRepository: new PrismaCashMovementRepository(),
      },
    );
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    return cashErrorResponse(error);
  }
}
