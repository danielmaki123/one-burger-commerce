import { describe, expect, it, vi } from "vitest";

import type { CustomerOtpRecord } from "@/modules/customers/domain/customer-auth.types";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { requestOtp } from "@/modules/customers/features/request-otp/request-otp";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import type { OtpSenderPort } from "@/modules/customers/ports/otp-sender";

function createOtpRecord(overrides: Partial<CustomerOtpRecord> = {}): CustomerOtpRecord {
  return {
    id: overrides.id ?? "otp_1",
    whatsappNormalized: overrides.whatsappNormalized ?? "+50586791327",
    codeHash: overrides.codeHash ?? "hash",
    expiresAt: overrides.expiresAt ?? new Date("2026-05-29T12:05:00.000Z"),
    attempts: overrides.attempts ?? 0,
    consumedAt: overrides.consumedAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-05-29T12:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-05-29T12:00:00.000Z"),
  };
}

function createRepository(
  initialOtps: CustomerOtpRecord[] = [],
): CustomerAuthRepository & { otps: CustomerOtpRecord[] } {
  const otps = [...initialOtps];
  return {
    otps,
    async findLatestOtpByWhatsapp(whatsappNormalized) {
      return (
        otps
          .filter((otp) => otp.whatsappNormalized === whatsappNormalized)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
      );
    },
    async invalidateActiveOtpsByWhatsapp(whatsappNormalized, consumedAt) {
      for (const otp of otps) {
        if (
          otp.whatsappNormalized === whatsappNormalized &&
          !otp.consumedAt &&
          otp.expiresAt > consumedAt
        ) {
          otp.consumedAt = consumedAt;
        }
      }
    },
    async createOtp(input) {
      const created = createOtpRecord({
        id: `otp_${otps.length + 1}`,
        whatsappNormalized: input.whatsappNormalized,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        consumedAt: null,
        createdAt: new Date("2026-05-29T12:00:00.000Z"),
        updatedAt: new Date("2026-05-29T12:00:00.000Z"),
      });
      otps.push(created);
      return created;
    },
    async incrementOtpAttempts() {},
    async consumeOtp() {},
    async findCustomerByWhatsapp() {
      return null;
    },
    async createCustomer() {
      throw new Error("Not used in requestOtp");
    },
    async updateCustomerFullName() {
      throw new Error("Not used in requestOtp");
    },
    async createSession() {},
    async findSessionByTokenHash() {
      return null;
    },
    async revokeSessionByTokenHash() {},
    async touchSession() {},
  };
}

function createOtpSender(sendSpy = vi.fn()): OtpSenderPort {
  return {
    sendOtp: sendSpy,
  };
}

describe("requestOtp", () => {
  it("normalizes whatsapp and returns masked uniform response", async () => {
    const repository = createRepository();
    const sendSpy = vi.fn();

    const result = await requestOtp(
      { whatsapp: "86791327" },
      {
        repository,
        otpSender: createOtpSender(sendSpy),
        now: new Date("2026-05-29T12:00:00.000Z"),
        otpCodeGenerator: () => "123456",
      },
    );

    expect(result.ok).toBe(true);
    expect(result.maskedWhatsapp).toBe("+505****1327");
    expect(result.expiresInSeconds).toBe(300);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappNormalized: "+50586791327",
        code: "123456",
      }),
    );
  });

  it("invalidates previous active otp before creating a new one", async () => {
    const previous = createOtpRecord({
      id: "otp_prev",
      createdAt: new Date("2026-05-29T11:50:00.000Z"),
      expiresAt: new Date("2026-05-29T12:30:00.000Z"),
    });
    const repository = createRepository([previous]);

    await requestOtp(
      { whatsapp: "+50586791327" },
      {
        repository,
        otpSender: createOtpSender(),
        now: new Date("2026-05-29T12:00:00.000Z"),
        otpCodeGenerator: () => "123456",
      },
    );

    expect(repository.otps[0]?.consumedAt).toEqual(
      new Date("2026-05-29T12:00:00.000Z"),
    );
    expect(repository.otps.length).toBe(2);
  });

  it("enforces cooldown and returns 429", async () => {
    const repository = createRepository([
      createOtpRecord({
        createdAt: new Date("2026-05-29T12:00:00.000Z"),
        expiresAt: new Date("2026-05-29T12:05:00.000Z"),
      }),
    ]);

    await expect(
      requestOtp(
        { whatsapp: "+50586791327" },
        {
          repository,
          otpSender: createOtpSender(),
          now: new Date("2026-05-29T12:00:30.000Z"),
          otpCodeGenerator: () => "123456",
        },
      ),
    ).rejects.toBeInstanceOf(CustomerAuthError);
  });
});
