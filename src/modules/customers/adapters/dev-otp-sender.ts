import { CustomerAuthError } from "@/modules/customers/domain/customer-auth-errors";
import { maskWhatsapp } from "@/modules/customers/domain/mask-whatsapp";
import type { OtpSenderPort, SendOtpInput } from "@/modules/customers/ports/otp-sender";

function isStagingSmokeModeEnabled() {
  return (
    process.env.APP_ENV === "staging" &&
    process.env.CUSTOMER_OTP_STAGING_SMOKE_MODE === "true" &&
    process.env.CUSTOMER_OTP_DEV_LOG === "true"
  );
}

export class DevOtpSender implements OtpSenderPort {
  async sendOtp(input: SendOtpInput) {
    const stagingSmokeModeEnabled = isStagingSmokeModeEnabled();

    if (process.env.NODE_ENV === "production" && !stagingSmokeModeEnabled) {
      throw new CustomerAuthError(
        503,
        "PROVIDER_NOT_CONFIGURED",
        "OTP provider is not configured for production",
      );
    }

    if (
      process.env.CUSTOMER_OTP_DEV_LOG === "true" &&
      (process.env.NODE_ENV !== "production" || stagingSmokeModeEnabled)
    ) {
      console.info(
        `[customer-otp-dev] whatsapp=${maskWhatsapp(input.whatsappNormalized)} code=${input.code} expiresAt=${input.expiresAt.toISOString()}`,
      );
    }
  }
}
