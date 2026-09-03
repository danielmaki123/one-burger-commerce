import { describe, expect, it, vi } from "vitest";

import { logoutCustomer } from "@/modules/customers/features/logout-customer/logout-customer";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";

function createRepository() {
  const revokeSpy = vi.fn();
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
      return null;
    },
    async revokeSessionByTokenHash(tokenHash, revokedAt) {
      revokeSpy(tokenHash, revokedAt);
    },
    async touchSession() {},
  };

  return { repository, revokeSpy };
}

describe("logoutCustomer", () => {
  it("revokes session when token exists", async () => {
    const { repository, revokeSpy } = createRepository();

    await logoutCustomer(
      "session_token",
      repository,
      new Date("2026-05-29T12:00:00.000Z"),
    );

    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });

  it("is idempotent without token", async () => {
    const { repository, revokeSpy } = createRepository();

    await logoutCustomer(undefined, repository);
    expect(revokeSpy).not.toHaveBeenCalled();
  });
});
