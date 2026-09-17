import { canManageCash } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";

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
