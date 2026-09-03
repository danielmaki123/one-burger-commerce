import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";
import { hashSessionToken } from "@/shared/lib/auth/session-token";

export async function logoutAdmin(
  sessionToken: string | undefined,
  repository: AdminAuthRepository,
) {
  if (!sessionToken) {
    return;
  }

  await repository.deleteSessionByTokenHash(hashSessionToken(sessionToken));
}

