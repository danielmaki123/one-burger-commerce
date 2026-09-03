export type CustomerRecord = {
  id: string;
  fullName: string | null;
  whatsappNormalized: string;
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
