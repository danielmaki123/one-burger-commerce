import { NextResponse } from "next/server";

import { cashConfigUpdateAudit } from "@/app/api/admin/audit-action-helpers";
import { canManageCashConfig } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaCashConfigRepository } from "@/modules/cash-config/adapters/prisma-cash-config-repository";
import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";
import { updateCashConfig } from "@/modules/cash-config/features/update-cash-config/update-cash-config";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — la puerta y el mapeo de errores de la config de caja.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas (`AGENTS.md`, y el contrato
 * de rutas lo mide): la ruta solo orquesta, y el permiso, el alcance y los errores se leen una vez.
 *
 * Dos cosas que resuelve:
 *
 * 1. **Solo el dueño** (`canManageCashConfig`) y **solo dentro del alcance**: la sucursal se valida con la
 *    misma puerta que la pantalla de Caja (`listCashLocations`), así un id ajeno responde 403 y no 404 con
 *    datos de otra sucursal.
 * 2. **El error del dominio sale como 422 con el detalle por campo** —el formulario muestra el mensaje
 *    debajo del campo que falló— sin tocar el mapeador compartido de errores (A-14: ese mapeador ya repite
 *    un `if` por módulo y no se hace crecer de gratis).
 */
export const CASH_CONFIG_NO_STORE = { "Cache-Control": "no-store" } as const;

export async function requireCashConfigScope(locationId: string) {
  const session = await requireAdminSession();

  if (!canManageCashConfig(session.user.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

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

export function cashConfigErrorResponse(error: unknown) {
  if (error instanceof CashConfigError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status, headers: CASH_CONFIG_NO_STORE },
    );
  }

  const response = createErrorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * El guardado completo: actualiza la config y **la firma** en el log de acciones sensibles.
 *
 * La config decide el arqueo de los turnos que vienen, así que el asiento es parte del guardado y no un
 * paso que la ruta pueda olvidar: se firma con quién, en qué sucursal y qué quedó configurado.
 */
export async function saveCashConfigForRoute(
  body: unknown,
  input: { actorUserId: string; repository: PrismaCashConfigRepository },
) {
  const data = await updateCashConfig(body, {
    repository: input.repository,
    updatedByUserId: input.actorUserId,
  });

  await cashConfigUpdateAudit({
    actorUserId: input.actorUserId,
    locationId: data.locationId,
    usdEnabled: data.usdEnabled,
    blindCount: data.blindCount,
  });

  return data;
}
