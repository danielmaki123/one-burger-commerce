import { describe, expect, it, vi } from "vitest";

import type {
  CustomerRecord,
  CustomerSessionRecord,
} from "@/modules/customers/domain/customer-auth.types";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { getCustomerSession } from "@/modules/customers/features/get-customer-session/get-customer-session";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import { hashSessionToken } from "@/shared/lib/auth/session-token";

function createCustomer(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: overrides.id ?? "cus_1",
    fullName: overrides.fullName ?? "Maria",
    whatsappNormalized: overrides.whatsappNormalized ?? "+50586791327",
    createdAt: overrides.createdAt ?? new Date("2026-05-29T12:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-05-29T12:00:00.000Z"),
  };
}

function createSession(
  overrides: Partial<CustomerSessionRecord> = {},
): CustomerSessionRecord {
  const customer = overrides.customer ?? createCustomer();
  return {
    id: overrides.id ?? "sess_1",
    customerId: overrides.customerId ?? customer.id,
    tokenHash: overrides.tokenHash ?? hashSessionToken("token_1"),
    expiresAt: overrides.expiresAt ?? new Date("2026-06-01T12:00:00.000Z"),
    revokedAt: overrides.revokedAt ?? null,
    lastSeenAt: overrides.lastSeenAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-05-29T12:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-05-29T12:00:00.000Z"),
    customer,
  };
}

function createRepository(session: CustomerSessionRecord | null) {
  const revokeSpy = vi.fn();
  const touchSpy = vi.fn();

  const repository: CustomerAuthRepository = {
    async findLatestOtpByWhatsapp() {
      return null;
    },
    async invalidateActiveOtpsByWhatsapp() {},
    async createOtp() {
      throw new Error("not used");
    },
    async incrementOtpAttempts() {},
    async consumeOtp() {},
    async findCustomerByWhatsapp() {
      return null;
    },
    async createCustomer() {
      throw new Error("not used");
    },
    async updateCustomerFullName() {
      throw new Error("not used");
    },
    async createSession() {},
    async findSessionByTokenHash() {
      return session;
    },
    async revokeSessionByTokenHash(tokenHash, revokedAt) {
      revokeSpy(tokenHash, revokedAt);
    },
    async touchSession(sessionId, lastSeenAt) {
      touchSpy(sessionId, lastSeenAt);
    },
  };

  return { repository, revokeSpy, touchSpy };
}

describe("getCustomerSession", () => {
  it("returns authenticated customer for valid session", async () => {
    const { repository, touchSpy } = createRepository(
      createSession({
        tokenHash: hashSessionToken("customer_token"),
      }),
    );

    const result = await getCustomerSession(
      "customer_token",
      repository,
      new Date("2026-05-29T12:00:00.000Z"),
    );

    expect(result.isAuthenticated).toBe(true);
    expect(result.customer.id).toBe("cus_1");
    expect(touchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns 401 without token", async () => {
    const { repository } = createRepository(null);

    await expect(getCustomerSession(undefined, repository)).rejects.toBeInstanceOf(
      CustomerAuthError,
    );
  });

  it("returns 401 for expired session and revokes it", async () => {
    const { repository, revokeSpy } = createRepository(
      createSession({
        tokenHash: hashSessionToken("expired_token"),
        expiresAt: new Date("2026-05-29T11:00:00.000Z"),
      }),
    );

    await expect(
      getCustomerSession(
        "expired_token",
        repository,
        new Date("2026-05-29T12:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(CustomerAuthError);

    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });
});
