import { createHash, randomInt } from "node:crypto";

import {
  CUSTOMER_OTP_COOLDOWN_SECONDS,
  CUSTOMER_OTP_TTL_SECONDS,
} from "@/modules/customers/domain/customer-auth-policy";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { maskWhatsapp } from "@/modules/customers/domain/mask-whatsapp";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import type { OtpSenderPort } from "@/modules/customers/ports/otp-sender";
import { normalizeWhatsapp } from "@/shared/lib/normalize-whatsapp";

type RequestOtpInput = {
  whatsapp: string;
};

type RequestOtpDependencies = {
  repository: CustomerAuthRepository;
  otpSender: OtpSenderPort;
  now?: Date;
  otpCodeGenerator?: () => string;
};

function buildOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtpCode(whatsappNormalized: string, code: string) {
  return createHash("sha256")
    .update(`${whatsappNormalized}:${code}`)
    .digest("hex");
}

export async function requestOtp(
  input: RequestOtpInput,
  {
    repository,
    otpSender,
    now = new Date(),
    otpCodeGenerator = buildOtpCode,
  }: RequestOtpDependencies,
) {
  const whatsappNormalized = normalizeWhatsapp(input.whatsapp);

  if (!whatsappNormalized) {
    throw new CustomerAuthError(400, "BAD_REQUEST", "Invalid WhatsApp number", {
      whatsapp: "Invalid WhatsApp number",
    });
  }

  const latestOtp = await repository.findLatestOtpByWhatsapp(whatsappNormalized);

  if (
    latestOtp &&
    !latestOtp.consumedAt &&
    latestOtp.expiresAt > now &&
    now.getTime() - latestOtp.createdAt.getTime() <
      CUSTOMER_OTP_COOLDOWN_SECONDS * 1000
  ) {
    throw new CustomerAuthError(
      429,
      "TOO_MANY_REQUESTS",
      "OTP request cooldown is active",
    );
  }

  await repository.invalidateActiveOtpsByWhatsapp(whatsappNormalized, now);

  const code = otpCodeGenerator();
  const expiresAt = new Date(now.getTime() + CUSTOMER_OTP_TTL_SECONDS * 1000);

  await repository.createOtp({
    whatsappNormalized,
    codeHash: hashOtpCode(whatsappNormalized, code),
    expiresAt,
  });

  await otpSender.sendOtp({
    whatsappNormalized,
    code,
    expiresAt,
  });

  // TODO(TASK-023D): aplicar rate-limit distribuido por IP/WhatsApp en edge/infra.
  return {
    ok: true as const,
    maskedWhatsapp: maskWhatsapp(whatsappNormalized),
    expiresInSeconds: CUSTOMER_OTP_TTL_SECONDS,
  };
}
