import {
  type AuthenticatedAdminUser,
  type AdminUserRecord,
} from "@/modules/auth/domain/admin-auth.types";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { ADMIN_SESSION_TTL_MS } from "@/modules/auth/domain/session-cookie";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";
import { verifyPassword, passwordNeedsRehash, hashPassword } from "@/shared/lib/auth/password-hasher";
import {
  generateSessionToken,
  hashSessionToken,
} from "@/shared/lib/auth/session-token";

type LoginAdminInput = {
  email: string;
  password: string;
};

type LoginAdminDependencies = {
  repository: AdminAuthRepository;
  now?: Date;
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

export async function loginAdmin(
  input: LoginAdminInput,
  { repository, now = new Date() }: LoginAdminDependencies,
) {
  const user = await repository.findUserByEmail(input.email.trim().toLowerCase());

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new AuthError(401, "UNAUTHORIZED", "Correo o contraseña incorrectos.");
  }

  // Rehash al entrar: es el único momento en que el servidor tiene la contraseña en
  // claro, así que un hash viejo (o con parámetros más débiles) se actualiza sin que
  // el usuario se entere. Es una mejora interna: si falla, la entrada sigue.
  if (passwordNeedsRehash(user.passwordHash)) {
    try {
      await repository.updateUserPassword(user.id, hashPassword(input.password));
    } catch (error) {
      console.error("[password-rehash] no se pudo actualizar el hash", error);
    }
  }

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);

  await repository.createSession({
    tokenHash: hashSessionToken(sessionToken),
    userId: user.id,
    expiresAt,
  });

  return {
    sessionToken,
    expiresAt,
    user: toAuthenticatedAdminUser(user),
  };
}

