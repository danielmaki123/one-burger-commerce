import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  CustomerOtpRecord,
  CustomerRecord,
  CustomerSessionRecord,
} from "@/modules/customers/domain/customer-auth.types";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { verifyOtp } from "@/modules/customers/features/verify-otp/verify-otp";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import { hashSessionToken } from "@/shared/lib/auth/session-token";

function hashOtpCode(whatsappNormalized: string, code: string) {
  return createHash("sha256")
    .update(`${whatsappNormalized}:${code}`)
    .digest("hex");
}

function createOtpRecord(overrides: Partial<CustomerOtpRecord> = {}): CustomerOtpRecord {
  return {
    id: overrides.id ?? "otp_1",
    whatsappNormalized: overrides.whatsappNormalized ?? "+50586791327",
    codeHash: overrides.codeHash ?? hashOtpCode("+50586791327", "123456"),
    expiresAt: overrides.expiresAt ?? new Date("2026-05-29T12:05:00.000Z"),
    attempts: overrides.attempts ?? 0,
    consumedAt: overrides.consumedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-05-29T12:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-05-29T12:00:00.000Z"),
  };
}

function createCustomerRecord(overrides: Partial<CustomerRecord> = {}): CustomerRecord {
  return {
    id: overrides.id ?? "cus_1",
    fullName: overrides.fullName ?? null,
    whatsappNormalized: overrides.whatsappNormalized ?? "+50586791327",
    createdAt: overrides.createdAt ?? new Date("2026-05-29T12:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-05-29T12:00:00.000Z"),
  };
}

function createRepository(input: {
  otp: CustomerOtpRecord | null;
  customer?: CustomerRecord | null;
}) {
  let currentOtp = input.otp;
  let currentCustomer = input.customer ?? null;
  const sessions: { customerId: string; tokenHash: string; expiresAt: Date }[] = [];

  const repository: CustomerAuthRepository = {
    async findLatestOtpByWhatsapp() {
      return currentOtp;
    },
    async invalidateActiveOtpsByWhatsapp() {},
    async createOtp() {
      throw new Error("not used");
    },
    async incrementOtpAttempts(_, attempts) {
      if (currentOtp) {
        currentOtp = { ...currentOtp, attempts };
      }
    },
    async consumeOtp(_, consumedAt) {
      if (currentOtp) {
        currentOtp = { ...currentOtp, consumedAt };
      }
    },
    async findCustomerByWhatsapp() {
      return currentCustomer;
    },
    async createCustomer(createInput) {
      currentCustomer = createCustomerRecord({
        id: "cus_created",
        fullName: createInput.fullName,
        whatsappNormalized: createInput.whatsappNormalized,
      });
      return currentCustomer;
    },
    async updateCustomerFullName(_, fullName) {
      if (!currentCustomer) {
        throw new Error("missing customer");
      }
      currentCustomer = { ...currentCustomer, fullName };
      return currentCustomer;
    },
    async createSession(sessionInput) {
      sessions.push(sessionInput);
    },
    async findSessionByTokenHash() {
      return null as CustomerSessionRecord | null;
    },
    async revokeSessionByTokenHash() {},
    async touchSession() {},
  };

  return {
    repository,
    getOtp: () => currentOtp,
    getCustomer: () => currentCustomer,
    getSessions: () => sessions,
  };
}

describe("verifyOtp", () => {
  it("creates customer and session on valid otp", async () => {
    const state = createRepository({
      otp: createOtpRecord(),
      customer: null,
    });

    const result = await verifyOtp(
      { whatsapp: "86791327", code: "123456" },
      {
        repository: state.repository,
        now: new Date("2026-05-29T12:00:00.000Z"),
      },
    );

    expect(result.customer.id).toBe("cus_created");
    expect(state.getOtp()?.consumedAt).toEqual(
      new Date("2026-05-29T12:00:00.000Z"),
    );
    expect(state.getSessions()).toHaveLength(1);
    expect(state.getSessions()[0]?.tokenHash).toBe(
      hashSessionToken(result.sessionToken),
    );
  });

  it("increments attempts on wrong otp", async () => {
    const state = createRepository({
      otp: createOtpRecord({ attempts: 1 }),
    });

    await expect(
      verifyOtp(
        { whatsapp: "86791327", code: "000000" },
        {
          repository: state.repository,
          now: new Date("2026-05-29T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(CustomerAuthError);

    expect(state.getOtp()?.attempts).toBe(2);
  });

  it("fails for expired otp", async () => {
    const state = createRepository({
      otp: createOtpRecord({
        expiresAt: new Date("2026-05-29T11:00:00.000Z"),
      }),
    });

    await expect(
      verifyOtp(
        { whatsapp: "86791327", code: "123456" },
        {
          repository: state.repository,
          now: new Date("2026-05-29T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(CustomerAuthError);
  });

  it("fails for consumed otp", async () => {
    const state = createRepository({
      otp: createOtpRecord({
        consumedAt: new Date("2026-05-29T11:59:00.000Z"),
      }),
    });

    await expect(
      verifyOtp(
        { whatsapp: "86791327", code: "123456" },
        {
          repository: state.repository,
          now: new Date("2026-05-29T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(CustomerAuthError);
  });
});
