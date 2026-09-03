import type {
  CustomerOtpRecord,
  CustomerRecord,
  CustomerSessionRecord,
} from "@/modules/customers/domain/customer-auth.types";

export interface CustomerAuthRepository {
  findLatestOtpByWhatsapp(
    whatsappNormalized: string,
  ): Promise<CustomerOtpRecord | null>;
  invalidateActiveOtpsByWhatsapp(
    whatsappNormalized: string,
    consumedAt: Date,
  ): Promise<void>;
  createOtp(input: {
    whatsappNormalized: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<CustomerOtpRecord>;
  incrementOtpAttempts(otpId: string, attempts: number): Promise<void>;
  consumeOtp(otpId: string, consumedAt: Date): Promise<void>;

  findCustomerByWhatsapp(
    whatsappNormalized: string,
  ): Promise<CustomerRecord | null>;
  createCustomer(input: {
    whatsappNormalized: string;
    fullName: string | null;
  }): Promise<CustomerRecord>;
  updateCustomerFullName(
    customerId: string,
    fullName: string,
  ): Promise<CustomerRecord>;

  createSession(input: {
    customerId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<CustomerSessionRecord | null>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
  touchSession(sessionId: string, lastSeenAt: Date): Promise<void>;
}
