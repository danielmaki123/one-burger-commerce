import { createHash, timingSafeEqual } from "node:crypto";

import { buildCustomerSessionExpiry } from "@/modules/customers/adapters/customer-session-cookie";
import { CUSTOMER_OTP_MAX_ATTEMPTS } from "@/modules/customers/domain/customer-auth-policy";
import type { CustomerRecord } from "@/modules/customers/domain/customer-auth.types";
import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import { generateSessionToken, hashSessionToken } from "@/shared/lib/auth/session-token";
import { normalizeWhatsapp } from "@/shared/lib/normalize-whatsapp";

type VerifyOtpInput = {
  whatsapp: string;
  code: string;
  fullName?: string;
};

type VerifyOtpDependencies = {
  repository: CustomerAuthRepository;
  now?: Date;
};

function normalizeName(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function hashOtpCode(whatsappNormalized: string, code: string) {
  return createHash("sha256")
    .update(`${whatsappNormalized}:${code}`)
    .digest("hex");
}

function isSameHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function findOrCreateCustomer(
  repository: CustomerAuthRepository,
  whatsappNormalized: string,
  fullName: string | undefined,
): Promise<CustomerRecord> {
  const existingCustomer = await repository.findCustomerByWhatsapp(
    whatsappNormalized,
  );

  if (!existingCustomer) {
    return repository.createCustomer({
      whatsappNormalized,
      fullName: fullName ?? null,
    });
  }

  if (fullName && existingCustomer.fullName !== fullName) {
    return repository.updateCustomerFullName(existingCustomer.id, fullName);
  }

  return existingCustomer;
}

export async function verifyOtp(
  input: VerifyOtpInput,
  { repository, now = new Date() }: VerifyOtpDependencies,
) {
  const whatsappNormalized = normalizeWhatsapp(input.whatsapp);
  const code = input.code.trim();
  const fullName = normalizeName(input.fullName);

  if (!whatsappNormalized) {
    throw new CustomerAuthError(400, "BAD_REQUEST", "Invalid WhatsApp number", {
      whatsapp: "Invalid WhatsApp number",
    });
  }

  if (!/^\d{6}$/.test(code)) {
    throw new CustomerAuthError(401, "UNAUTHORIZED", "Invalid verification code");
  }

  const otp = await repository.findLatestOtpByWhatsapp(whatsappNormalized);

  if (!otp || otp.consumedAt || otp.expiresAt <= now) {
    throw new CustomerAuthError(401, "UNAUTHORIZED", "Invalid verification code");
  }

  if (otp.attempts >= CUSTOMER_OTP_MAX_ATTEMPTS) {
    throw new CustomerAuthError(401, "UNAUTHORIZED", "Invalid verification code");
  }

  const incomingHash = hashOtpCode(whatsappNormalized, code);

  if (!isSameHash(otp.codeHash, incomingHash)) {
    await repository.incrementOtpAttempts(otp.id, otp.attempts + 1);
    throw new CustomerAuthError(401, "UNAUTHORIZED", "Invalid verification code");
  }

  await repository.consumeOtp(otp.id, now);
  const customer = await findOrCreateCustomer(
    repository,
    whatsappNormalized,
    fullName,
  );

  const sessionToken = generateSessionToken();
  const expiresAt = buildCustomerSessionExpiry(now);
  await repository.createSession({
    customerId: customer.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  return {
    customer,
    sessionToken,
    expiresAt,
  };
}
