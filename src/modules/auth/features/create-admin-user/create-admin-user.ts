import type {
  AdminUserRecord,
  AuthenticatedAdminUser,
} from "@/modules/auth/domain/admin-auth.types";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { canManageUsers } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";
import { hashPassword } from "@/shared/lib/auth/password-hasher";

type CreateAdminUserInput = {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
};

type CreateAdminUserDependencies = {
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

export async function createAdminUser(
  input: CreateAdminUserInput,
  { repository, actorRole }: CreateAdminUserDependencies,
) {
  if (!canManageUsers(actorRole)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const email = input.email.trim().toLowerCase();
  const existing = await repository.findUserByEmail(email);

  if (existing) {
    throw new AuthError(400, "BAD_REQUEST", "User email already exists");
  }

  const user = await repository.createUser({
    name: input.name.trim(),
    email,
    passwordHash: hashPassword(input.password),
    role: input.role,
  });

  return { data: toAuthenticatedAdminUser(user) };
}
