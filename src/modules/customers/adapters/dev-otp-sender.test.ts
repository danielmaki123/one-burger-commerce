import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { DevOtpSender } from "@/modules/customers/adapters/dev-otp-sender";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
  CUSTOMER_OTP_STAGING_SMOKE_MODE: process.env.CUSTOMER_OTP_STAGING_SMOKE_MODE,
  CUSTOMER_OTP_DEV_LOG: process.env.CUSTOMER_OTP_DEV_LOG,
};

function setEnvVar(name: string, value: string | undefined) {
  const mutableEnv = process.env as Record<string, string | undefined>;
  mutableEnv[name] = value;
}

describe("DevOtpSender", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setEnvVar("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
    setEnvVar("APP_ENV", ORIGINAL_ENV.APP_ENV);
    setEnvVar(
      "CUSTOMER_OTP_STAGING_SMOKE_MODE",
      ORIGINAL_ENV.CUSTOMER_OTP_STAGING_SMOKE_MODE,
    );
    setEnvVar("CUSTOMER_OTP_DEV_LOG", ORIGINAL_ENV.CUSTOMER_OTP_DEV_LOG);
  });

  afterEach(() => {
    setEnvVar("NODE_ENV", ORIGINAL_ENV.NODE_ENV);
    setEnvVar("APP_ENV", ORIGINAL_ENV.APP_ENV);
    setEnvVar(
      "CUSTOMER_OTP_STAGING_SMOKE_MODE",
      ORIGINAL_ENV.CUSTOMER_OTP_STAGING_SMOKE_MODE,
    );
    setEnvVar("CUSTOMER_OTP_DEV_LOG", ORIGINAL_ENV.CUSTOMER_OTP_DEV_LOG);
  });

  it("blocks production by default without real provider", async () => {
    setEnvVar("NODE_ENV", "production");
    setEnvVar("APP_ENV", "prod");
    setEnvVar("CUSTOMER_OTP_STAGING_SMOKE_MODE", "false");
    setEnvVar("CUSTOMER_OTP_DEV_LOG", "false");

    const sender = new DevOtpSender();

    await expect(
      sender.sendOtp({
        whatsappNormalized: "+50586791327",
        code: "123456",
        expiresAt: new Date("2026-05-29T20:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(CustomerAuthError);
  });

  it("allows staging smoke mode in production runtime when explicitly enabled", async () => {
    setEnvVar("NODE_ENV", "production");
    setEnvVar("APP_ENV", "staging");
    setEnvVar("CUSTOMER_OTP_STAGING_SMOKE_MODE", "true");
    setEnvVar("CUSTOMER_OTP_DEV_LOG", "true");

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = new DevOtpSender();

    await expect(
      sender.sendOtp({
        whatsappNormalized: "+50586791327",
        code: "123456",
        expiresAt: new Date("2026-05-29T20:00:00.000Z"),
      }),
    ).resolves.toBeUndefined();

    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("does not allow staging bypass when APP_ENV is not staging", async () => {
    setEnvVar("NODE_ENV", "production");
    setEnvVar("APP_ENV", "prod");
    setEnvVar("CUSTOMER_OTP_STAGING_SMOKE_MODE", "true");
    setEnvVar("CUSTOMER_OTP_DEV_LOG", "true");

    const sender = new DevOtpSender();

    await expect(
      sender.sendOtp({
        whatsappNormalized: "+50586791327",
        code: "123456",
        expiresAt: new Date("2026-05-29T20:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(CustomerAuthError);
  });
});
