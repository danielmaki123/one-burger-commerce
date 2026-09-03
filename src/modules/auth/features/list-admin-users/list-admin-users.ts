import type {
  AdminUserRecord,
  AuthenticatedAdminUser,
} from "@/modules/auth/domain/admin-auth.types";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { canManageUsers } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";

type ListAdminUsersDependencies = {
  repository: AdminAuthRepository;
  actorRole: AdminRole;
};

function toAuthenticatedAdminUser(
  user: AdminUserRecord,
): AuthenticatedAdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

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
