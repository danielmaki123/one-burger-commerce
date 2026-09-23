import { NextResponse } from "next/server";

import { cashTerminalsUpdateAudit } from "@/app/api/admin/audit-action-helpers";
import { canManageCashConfig } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaCashConfigRepository } from "@/modules/cash-config/adapters/prisma-cash-config-repository";
import { CashConfigError } from "@/modules/cash-config/domain/cash-config-errors";
import type { PosTerminalRecord } from "@/modules/cash-config/domain/cash-config.types";
import { getCashTerminals } from "@/modules/cash-config/features/get-cash-terminals/get-cash-terminals";
import { saveCashTerminals } from "@/modules/cash-config/features/save-cash-terminals/save-cash-terminals";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Fase 6 del rediseño de Caja (2026-09-23) — la puerta, el alcance y el guardado de las **terminales del
 * POS**.
 *
 * Mismas dos reglas que la config del conteo: **solo el dueño** (`canManageCashConfig`) —con qué estaciones
 * cuenta el local decide cómo se abren y se cierran las cajas— y **el alcance por sucursal** se comprueba
 * contra las sucursales que ofrece la Caja, así un id ajeno responde 403 y no un error de base.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas (`AGENTS.md`).
 */
export const TERMINALS_NO_STORE = { "Cache-Control": "no-store" } as const;

export async function requireCashTerminalsScope(locationId: string) {
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

export function cashTerminalsErrorResponse(error: unknown) {
  if (error instanceof CashConfigError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status, headers: TERMINALS_NO_STORE },
    );
  }

  const response = createErrorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Las terminales de una sucursal (activas y apagadas), para el selector de Caja y la pantalla de config. */
export async function getCashTerminalsForRoute(locationId: string) {
  const { repository } = await requireCashTerminalsScope(locationId);

  return getCashTerminals({ locationIds: [locationId] }, { repository });
}

/**
 * El guardado completo: valida, guarda y **firma** en el log de acciones sensibles.
 *
 * Cambiar las estaciones del local cambia con qué se abre cada caja, así que el asiento es parte del
 * guardado y no un paso que la ruta pueda olvidar: la sesión se resuelve acá una sola vez y se firma en qué
 * sucursal y cuántas terminales quedaron activas.
 */
export async function saveCashTerminalsForRoute(body: unknown) {
  const locationId = readLocationId(body);
  const { session, repository } = await requireCashTerminalsScope(locationId);
  const data = await saveCashTerminals(
    { locationId, terminals: readTerminalEntries(body) },
    { repository },
  );

  await cashTerminalsUpdateAudit({
    actorUserId: session.user.id,
    locationId,
    terminals: data.terminals.filter((terminal) => terminal.isActive).length,
  });

  return data;
}

function readLocationId(body: unknown): string {
  const locationId = (body as { locationId?: unknown })?.locationId;

  return typeof locationId === "string" ? locationId.trim() : "";
}

/** Las terminales tal como vienen del formulario. La forma fina la valida el dominio, no la ruta. */
function readTerminalEntries(body: unknown): Omit<PosTerminalRecord, "locationId">[] {
  const terminals = (body as { terminals?: unknown })?.terminals;

  if (!Array.isArray(terminals)) return [];

  return terminals.map((terminal, index) => {
    const entry = terminal as Partial<PosTerminalRecord>;

    return {
      id: typeof entry.id === "string" ? entry.id : "",
      label: typeof entry.label === "string" ? entry.label : "",
      isActive: entry.isActive !== false,
      sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : index,
    };
  });
}
