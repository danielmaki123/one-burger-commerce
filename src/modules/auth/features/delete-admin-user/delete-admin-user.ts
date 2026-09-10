import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import { canManageUsers } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";

type DeleteAdminUserInput = {
  userId: string;
};

type DeleteAdminUserDependencies = {
  repository: AdminAuthRepository;
  actorRole: AdminRole;
  actorUserId: string;
};

function countOwners(users: AdminUserRecord[]): number {
  return users.filter((user) => user.role === ADMIN_ROLES.owner).length;
}

export async function deleteAdminUser(
  input: DeleteAdminUserInput,
  { repository, actorRole, actorUserId }: DeleteAdminUserDependencies,
) {
  if (!canManageUsers(actorRole)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  if (input.userId === actorUserId) {
    throw new AuthError(
      400,
      "BAD_REQUEST",
      "You cannot delete your own account",
      { userId: "No podés borrar tu propia cuenta" },
    );
  }

  const target = await repository.findUserById(input.userId);
  if (!target) {
    throw new AuthError(404, "NOT_FOUND", "Admin user not found");
  }

  if (target.role === ADMIN_ROLES.owner) {
    const users = await repository.listUsers();

    if (countOwners(users) <= 1) {
      throw new AuthError(
        400,
        "BAD_REQUEST",
        "At least one owner must remain",
        { userId: "Tiene que quedar al menos un owner" },
      );
    }
  }

  await repository.deleteUser(input.userId);

  return { data: { id: input.userId } };
}
