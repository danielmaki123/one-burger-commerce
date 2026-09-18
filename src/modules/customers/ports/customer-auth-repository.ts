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
  /**
   * Punto 4 del roadmap (2026-09-18) — el cliente por id. Lo necesita `emitInvoice`: la factura se emite
   * desde el detalle del pedido, donde el RUC que el cajero cargó en el POS no está en el body.
   */
  findCustomerById(customerId: string): Promise<CustomerRecord | null>;
  createCustomer(input: {
    whatsappNormalized: string;
    fullName: string | null;
  }): Promise<CustomerRecord>;
  updateCustomerFullName(
    customerId: string,
    fullName: string,
  ): Promise<CustomerRecord>;
  /**
   * Punto 4 — **actualiza** los datos fiscales del cliente (los dos, ya normalizados). Se llama en cada
   * venta con factura: el cliente que ya existía se queda con el RUC que dio esta vez.
   */
  updateCustomerFiscalData(
    customerId: string,
    fiscal: { taxId: string; legalName: string },
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
