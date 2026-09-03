import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import { hashSessionToken } from "@/shared/lib/auth/session-token";

export async function getCustomerSession(
  sessionToken: string | undefined,
  repository: CustomerAuthRepository,
  now = new Date(),
) {
  if (!sessionToken) {
    throw new CustomerAuthError(401, "UNAUTHORIZED", "Customer session expired");
  }

  const session = await repository.findSessionByTokenHash(
    hashSessionToken(sessionToken),
  );

  if (!session || session.revokedAt) {
    throw new CustomerAuthError(401, "UNAUTHORIZED", "Customer session expired");
  }

  if (session.expiresAt <= now) {
    await repository.revokeSessionByTokenHash(session.tokenHash, now);
    throw new CustomerAuthError(401, "UNAUTHORIZED", "Customer session expired");
  }

  await repository.touchSession(session.id, now);

  return {
    isAuthenticated: true as const,
    customer: {
      id: session.customer.id,
      fullName: session.customer.fullName,
      whatsappNormalized: session.customer.whatsappNormalized,
    },
  };
}
