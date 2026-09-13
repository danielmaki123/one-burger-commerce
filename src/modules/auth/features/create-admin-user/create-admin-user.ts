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
import { hashPassword } from "@/shared/lib/auth/password-hasher";

type CreateAdminUserInput = {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
  /** Sucursales asignadas (A). Sin lista, el usuario ve todas. */
  locationIds?: string[];
};

type CreateAdminUserDependencies = {
  repository: AdminAuthRepository;
  locationRepository: LocationRepository;
  actorRole: AdminRole;
};

export async function createAdminUser(
  input: CreateAdminUserInput,
  { repository, locationRepository, actorRole }: CreateAdminUserDependencies,
) {
  if (!canManageUsers(actorRole)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const email = input.email.trim().toLowerCase();
  const existing = await repository.findUserByEmail(email);

  if (existing) {
    throw new AuthError(400, "BAD_REQUEST", "User email already exists");
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

  const user = await repository.createUser({
    name: input.name.trim(),
    email,
    passwordHash: hashPassword(input.password),
    role: input.role,
    locationIds,
  });

  return { data: toAuthenticatedAdminUser(user) };
}
