import type { AuthenticatedAdminUser } from "@/modules/auth/domain/admin-auth.types";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { canManageUsers } from "@/modules/auth/domain/admin-permissions";
import { toAuthenticatedAdminUser } from "@/modules/auth/domain/admin-user-view";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";
import {
  findUnknownLocationIds,
  normalizeLocationIds,
  UNKNOWN_LOCATION_MESSAGE,
} from "@/modules/locations/domain/location-ids";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";

type UpdateAdminUserLocationsInput = {
  userId: string;
  /** Lo que queda guardado: es un guardado completo, como el formulario de locales. */
  locationIds: string[];
};

type UpdateAdminUserLocationsDependencies = {
  repository: AdminAuthRepository;
  locationRepository: LocationRepository;
  actorRole: AdminRole;
};

/**
 * A — las sucursales que puede ver un usuario del staff.
 *
 * Guardado **completo**: lo que se manda es lo que queda (una lista vacía lo devuelve a "ve
 * todas"). Las sucursales se validan contra las que existen: un id inventado no se guarda en
 * silencio, porque dejaría al usuario acotado a una sucursal fantasma.
 *
 * Al `owner` se le puede guardar una asignación, pero el alcance de pedidos la ignora (ve todo).
 */
export async function updateAdminUserLocations(
  input: UpdateAdminUserLocationsInput,
  { repository, locationRepository, actorRole }: UpdateAdminUserLocationsDependencies,
): Promise<{ data: AuthenticatedAdminUser }> {
  if (!canManageUsers(actorRole)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const target = await repository.findUserById(input.userId);
  if (!target) {
    throw new AuthError(404, "NOT_FOUND", "Admin user not found");
  }

  const locationIds = normalizeLocationIds(input.locationIds);
  const locations = await locationRepository.listLocations();
  const unknown = findUnknownLocationIds(
    locationIds,
    locations.map((location) => location.id),
  );

  if (unknown.length > 0) {
    throw new AuthError(400, "BAD_REQUEST", "Unknown locations", {
      locationIds: UNKNOWN_LOCATION_MESSAGE,
    });
  }

  const updated = await repository.setUserLocations(input.userId, locationIds);

  return { data: toAuthenticatedAdminUser(updated) };
}
