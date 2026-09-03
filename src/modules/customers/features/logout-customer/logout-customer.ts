import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import { hashSessionToken } from "@/shared/lib/auth/session-token";

export async function logoutCustomer(
  sessionToken: string | undefined,
  repository: CustomerAuthRepository,
  now = new Date(),
) {
  if (!sessionToken) {
    return;
  }

  await repository.revokeSessionByTokenHash(hashSessionToken(sessionToken), now);
}
