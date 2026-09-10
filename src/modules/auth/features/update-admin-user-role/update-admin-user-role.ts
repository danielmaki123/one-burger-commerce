import type { AuthenticatedAdminUser } from "@/modules/auth/domain/admin-auth.types";
import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";
import { isAdminRole, type AdminRole, ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { canManageUsers } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";

type UpdateAdminUserRoleInput = {
  userId: string;
  role: AdminRole;
};

type UpdateAdminUserRoleDependencies = {
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

function countOwners(users: AdminUserRecord[]): number {
  return users.filter((user) => user.role === ADMIN_ROLES.owner).length;
}

export async function updateAdminUserRole(
  input: UpdateAdminUserRoleInput,
  { repository, actorRole }: UpdateAdminUserRoleDependencies,
) {
  if (!canManageUsers(actorRole)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  if (!isAdminRole(input.role)) {
    throw new AuthError(400, "BAD_REQUEST", "Invalid role", {
      role: "Rol inválido",
    });
  }

  const target = await repository.findUserById(input.userId);
  if (!target) {
    throw new AuthError(404, "NOT_FOUND", "Admin user not found");
  }

  if (target.role === input.role) {
    return { data: toAuthenticatedAdminUser(target) };
  }

  if (target.role === ADMIN_ROLES.owner && input.role !== ADMIN_ROLES.owner) {
    const users = await repository.listUsers();

    if (countOwners(users) <= 1) {
      throw new AuthError(
        400,
        "BAD_REQUEST",
        "At least one owner must remain",
        { role: "Tiene que quedar al menos un owner" },
      );
    }
  }

  const updated = await repository.updateUserRole(input.userId, input.role);

  return { data: toAuthenticatedAdminUser(updated) };
}
