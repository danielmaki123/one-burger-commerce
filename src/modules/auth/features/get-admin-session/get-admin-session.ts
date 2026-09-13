import { toAuthenticatedAdminUser } from "@/modules/auth/domain/admin-user-view";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";
import { hashSessionToken } from "@/shared/lib/auth/session-token";

export async function getAdminSession(
  sessionToken: string | undefined,
  repository: AdminAuthRepository,
  now = new Date(),
) {
  if (!sessionToken) {
    throw new AuthError(401, "UNAUTHORIZED", "Admin session expired");
  }

  const session = await repository.findSessionByTokenHash(
    hashSessionToken(sessionToken),
  );

  if (!session) {
    throw new AuthError(401, "UNAUTHORIZED", "Admin session expired");
  }

  if (session.expiresAt <= now) {
    await repository.deleteSessionByTokenHash(session.tokenHash);
    throw new AuthError(401, "UNAUTHORIZED", "Admin session expired");
  }

  return {
    isAuthenticated: true as const,
    // La vista del usuario lleva sus sucursales (A): el alcance de cada request sale de acá.
    user: toAuthenticatedAdminUser(session.user),
  };
}

