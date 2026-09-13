import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { canManageUsers } from "@/modules/auth/domain/admin-permissions";
import { toAuthenticatedAdminUser } from "@/modules/auth/domain/admin-user-view";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";

type ListAdminUsersDependencies = {
  repository: AdminAuthRepository;
  actorRole: AdminRole;
};

export async function listAdminUsers({
  repository,
  actorRole,
}: ListAdminUsersDependencies) {
  if (!canManageUsers(actorRole)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const users = await repository.listUsers();

  return { data: users.map(toAuthenticatedAdminUser) };
}
