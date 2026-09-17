import { canManageCash } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Bloque 1.3/7 del roadmap del POS (Fase 2) — la puerta de la caja del día.
 *
 * Es la hermana de `requirePosLocation` (que es del **mostrador**): acá no se pide un local con el POS
 * prendido ni un rol que cobre, sino alguien que **administre la caja** (dueño o manager) y un local
 * dentro de su alcance. El cajero no entra: el cierre de su propio turno no lo audita él.
 *
 * El repositorio entra por parámetro (con el adaptador de producción por defecto) porque el permiso y
 * el alcance son lo que hay que poder probar sin base de datos.
 */
export function assertCanManageCash(role: AdminRole): void {
  if (!canManageCash(role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

export async function requireCashScope(
  input: {
    role: AdminRole;
    assignedLocationIds?: readonly string[] | null;
  },
  dependencies?: { repository: Pick<LocationRepository, "listLocations"> },
): Promise<LocationRecord[]> {
  assertCanManageCash(input.role);

  const repository =
    dependencies?.repository ?? createProductionPosLocationDependencies().repository;

  const locations = listCashLocations(
    await repository.listLocations(),
    resolveOrderLocationScope({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
    }),
  );

  if (locations.length === 0) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  return locations;
}

/**
 * Bloque 2 del roadmap del POS (Fase 2) — un turno de caja dentro del alcance de quien lo pide.
 *
 * Es la guarda que comparten las rutas del turno (movimientos, reapertura): permiso de control,
 * alcance por sucursal y 404 —no 403— para un turno de otra sucursal, porque un id ajeno no debería
 * confirmar que existe.
 */
export async function requireCashShift(
  input: {
    id: string;
    role: AdminRole;
    assignedLocationIds?: readonly string[] | null;
  },
  dependencies?: { repository?: Pick<ShiftRepository, "findShiftById"> },
): Promise<ShiftRecord> {
  const locations = await requireCashScope({
    role: input.role,
    assignedLocationIds: input.assignedLocationIds,
  });

  const repository = dependencies?.repository ?? new PrismaShiftRepository();
  const shift = await repository.findShiftById(input.id);

  if (!shift || !locations.some((location) => location.id === shift.locationId)) {
    throw new ShiftError(404, "NOT_FOUND", "No encontramos ese turno de caja.");
  }

  return shift;
}

/**
 * La guarda completa de una ruta del turno, en una línea: sesión → permiso y alcance → turno dentro
 * del alcance. Devuelve **el id del turno** (el de la URL, ya validado), que es lo único que la ruta
 * necesita para llamar al caso de uso.
 */
export async function requireCashShiftId(params: { id: string }): Promise<string> {
  const session = await requireAdminSession();

  await requireCashShift({
    id: params.id,
    role: session.user.role,
    assignedLocationIds: session.user.locationIds,
  });

  return params.id;
}

/** La respuesta de error de las rutas de caja, sin repetir el `no-store` en cada handler. */
export function cashErrorResponse(error: unknown) {
  const response = createErrorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
