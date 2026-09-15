import { NextResponse } from "next/server";

import {
  parsePosSalePayload,
  resolveSaleLocationId,
  toPosSaleResponse,
} from "@/app/api/admin/pos/sale/sale-payload";
import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createProductionPosSaleDependencies } from "@/modules/pos/adapters/production-pos-sale";
import { registerPosSale } from "@/modules/pos/features/register-pos-sale/register-pos-sale";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/** TASK-303b — cobrar una venta de mostrador: pide y paga de una vez. Solo orquesta. */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();

    if (!canUsePOS(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const { input, locationId } = parsePosSalePayload(await request.json());
    resolveSaleLocationId({
      requested: locationId,
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    });

    const result = await registerPosSale(input, await createProductionPosSaleDependencies());

    return NextResponse.json(
      { data: toPosSaleResponse(result) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
