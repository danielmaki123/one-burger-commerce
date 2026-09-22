import { NextResponse } from "next/server";

import { cashConfigUpdateAudit } from "@/app/api/admin/audit-action-helpers";
import { canManageCashConfig } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaCashConfigRepository } from "@/modules/cash-config/adapters/prisma-cash-config-repository";
import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";
import { getCashConfig } from "@/modules/cash-config/features/get-cash-config/get-cash-config";
import { updateCashConfig } from "@/modules/cash-config/features/update-cash-config/update-cash-config";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — `GET`/`PUT /api/admin/cash/config`.
 *
 * **Solo el dueño** (`canManageCashConfig`): esta configuración cambia las reglas con las que se firma un
 * arqueo (qué monedas se cuentan, con qué billetes y si el cajero ve el esperado), no es operar la caja.
 *
 * El alcance por sucursal se respeta igual que en el resto del panel: un owner ve todas; el manager no
 * entra (ni con URL directa) y el cajero tampoco. La ruta solo orquesta: el permiso, la validación y la
 * persistencia viven en el módulo (`cash-config`).
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

async function requireCashConfigScope(locationId: string) {
  const session = await requireAdminSession();

  if (!canManageCashConfig(session.user.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  // El alcance se resuelve con la misma puerta que la pantalla de Caja (`listCashLocations`): una sucursal
  // ajena no se puede ni leer ni escribir, aunque el id viaje a mano.
  const allowed = listCashLocations(
    await createProductionPosLocationDependencies().repository.listLocations(),
    resolveOrderLocationScope({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    }),
  );

  if (!allowed.some((location) => location.id === locationId)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  return { session, repository: new PrismaCashConfigRepository() };
}

function errorResponse(error: unknown) {
  if (error instanceof CashConfigError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status, headers: NO_STORE },
    );
  }

  const response = createErrorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId") ?? "";
    const { repository } = await requireCashConfigScope(locationId);

    const data = await getCashConfig({ locationId }, { repository });

    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { locationId?: string };
    const { session, repository } = await requireCashConfigScope(body.locationId?.trim() ?? "");

    const data = await updateCashConfig(body, {
      repository,
      updatedByUserId: session.user.id,
    });

    // Firmar el cambio es parte de la acción: la config decide el arqueo de los turnos que vienen.
    await cashConfigUpdateAudit({
      actorUserId: session.user.id,
      locationId: data.locationId,
      usdEnabled: data.usdEnabled,
      blindCount: data.blindCount,
    });

    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}
