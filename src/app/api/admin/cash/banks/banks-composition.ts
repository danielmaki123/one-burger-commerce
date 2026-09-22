import { NextResponse } from "next/server";

import { cashBanksUpdateAudit } from "@/app/api/admin/audit-action-helpers";
import { PrismaBankRepository } from "@/modules/banks/adapters/prisma-bank-repository";
import { BankError } from "@/modules/banks/domain/bank-errors";
import type { BankCatalogEntry } from "@/modules/banks/domain/bank.types";
import { getBankCatalog } from "@/modules/banks/features/get-bank-catalog/get-bank-catalog";
import { saveBankCatalog } from "@/modules/banks/features/save-bank-catalog/save-bank-catalog";
import { canManageCashConfig } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — la puerta, el alcance y el guardado del catálogo de bancos.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas (`AGENTS.md`, y el contrato
 * de rutas lo mide).
 *
 * Dos reglas:
 *
 * 1. **Solo el dueño** (`canManageCashConfig`), igual que la config del conteo: con qué bancos liquida la
 *    sucursal decide contra qué se cuadra el lote de la terminal. No es operar la caja.
 * 2. **El alcance se comprueba sobre las sucursales del panel**: un id que no esté en la lista responde
 *    403 aunque venga armado a mano — así un payload no puede asignar un banco a una sucursal que no
 *    existe. Como la puerta es del dueño, la lista es la de todas las sucursales (no hay alcance parcial
 *    que recortar: `canManageCashConfig` ya dejó afuera al manager y al cajero).
 */
export const BANKS_NO_STORE = { "Cache-Control": "no-store" } as const;

export async function requireBankCatalogScope() {
  const session = await requireAdminSession();

  if (!canManageCashConfig(session.user.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const locations = await createProductionPosLocationDependencies().repository.listLocations();

  return {
    session,
    repository: new PrismaBankRepository(),
    allowedLocationIds: locations.map((location) => location.id),
  };
}

export function banksErrorResponse(error: unknown) {
  if (error instanceof BankError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fields: error.fields } },
      { status: error.status, headers: BANKS_NO_STORE },
    );
  }

  const response = createErrorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function getBankCatalogForRoute() {
  return getBankCatalog({ repository: new PrismaBankRepository() });
}

/**
 * El guardado completo: se valida que todas las sucursales del payload estén dentro del panel y recién
 * entonces se guarda y **se firma**.
 *
 * La firma dice cuántos bancos y en cuántas sucursales quedaron: es la regla con la que se cuadra el lote
 * de cada terminal, así que seis meses después esto explica por qué ese cierre ofrecía —o no— un banco.
 */
export async function saveBankCatalogForRoute(
  body: unknown,
  input: { actorUserId: string; allowedLocationIds: string[] },
) {
  const banks = readBankEntries(body);
  const allowed = new Set(input.allowedLocationIds);
  const outside = banks.flatMap((bank) => bank.locationIds).filter((id) => !allowed.has(id));

  if (outside.length > 0) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const data = await saveBankCatalog({ banks }, { repository: new PrismaBankRepository() });

  await cashBanksUpdateAudit({
    actorUserId: input.actorUserId,
    banks: data.banks.filter((bank) => bank.isActive).length,
    locations: new Set(data.banks.flatMap((bank) => bank.locationIds)).size,
  });

  return data;
}

/** El catálogo tal como viene del formulario. La forma fina la valida el dominio, no la ruta. */
function readBankEntries(body: unknown): BankCatalogEntry[] {
  const banks = (body as { banks?: unknown })?.banks;

  if (!Array.isArray(banks)) return [];

  return banks.map((bank, index) => {
    const entry = bank as Partial<BankCatalogEntry>;

    return {
      id: typeof entry.id === "string" ? entry.id : "",
      name: typeof entry.name === "string" ? entry.name : "",
      code: typeof entry.code === "string" ? entry.code : null,
      isActive: entry.isActive !== false,
      sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : index,
      locationIds: Array.isArray(entry.locationIds)
        ? entry.locationIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  });
}
