export type CustomerRecord = {
  id: string;
  fullName: string | null;
  whatsappNormalized: string;
  /**
   * Punto 4 del roadmap (2026-09-18) — los datos fiscales del cliente, si pidió factura con RUC. Los dos
   * van juntos: media factura no se guarda (`resolveCustomerFiscalData`).
   */
  taxId?: string | null;
  legalName?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerOtpRecord = {
  id: string;
  whatsappNormalized: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerSessionRecord = {
  id: string;
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customer: CustomerRecord;
};
