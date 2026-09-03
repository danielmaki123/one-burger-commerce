import type {
  CustomerOtpRecord,
  CustomerRecord,
  CustomerSessionRecord,
} from "@/modules/customers/domain/customer-auth.types";
import type { CustomerAuthRepository } from "@/modules/customers/ports/customer-auth-repository";
import { getPrismaClient } from "@/infrastructure/database/prisma";

function mapCustomer(customer: {
  id: string;
  fullName: string | null;
  whatsappNormalized: string;
  createdAt: Date;
  updatedAt: Date;
}): CustomerRecord {
  return {
    id: customer.id,
    fullName: customer.fullName,
    whatsappNormalized: customer.whatsappNormalized,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function mapOtp(otp: {
  id: string;
  whatsappNormalized: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerOtpRecord {
  return {
    id: otp.id,
    whatsappNormalized: otp.whatsappNormalized,
    codeHash: otp.codeHash,
    expiresAt: otp.expiresAt,
    attempts: otp.attempts,
    consumedAt: otp.consumedAt,
    createdAt: otp.createdAt,
    updatedAt: otp.updatedAt,
  };
}

export class PrismaCustomerAuthRepository implements CustomerAuthRepository {
  async findLatestOtpByWhatsapp(whatsappNormalized: string) {
    const prisma = getPrismaClient();
    const otp = await prisma.customerOtp.findFirst({
      where: { whatsappNormalized },
      orderBy: { createdAt: "desc" },
    });

    return otp ? mapOtp(otp) : null;
  }

  async invalidateActiveOtpsByWhatsapp(whatsappNormalized: string, consumedAt: Date) {
    const prisma = getPrismaClient();
    await prisma.customerOtp.updateMany({
      where: {
        whatsappNormalized,
        consumedAt: null,
        expiresAt: { gt: consumedAt },
      },
      data: { consumedAt },
    });
  }

  async createOtp(input: {
    whatsappNormalized: string;
    codeHash: string;
    expiresAt: Date;
  }) {
    const prisma = getPrismaClient();
    const otp = await prisma.customerOtp.create({
      data: input,
    });

    return mapOtp(otp);
  }

  async incrementOtpAttempts(otpId: string, attempts: number) {
    const prisma = getPrismaClient();
    await prisma.customerOtp.update({
      where: { id: otpId },
      data: { attempts },
    });
  }

  async consumeOtp(otpId: string, consumedAt: Date) {
    const prisma = getPrismaClient();
    await prisma.customerOtp.updateMany({
      where: { id: otpId, consumedAt: null },
      data: { consumedAt },
    });
  }

  async findCustomerByWhatsapp(whatsappNormalized: string) {
    const prisma = getPrismaClient();
    const customer = await prisma.customer.findUnique({
      where: { whatsappNormalized },
    });

    return customer ? mapCustomer(customer) : null;
  }

  async createCustomer(input: {
    whatsappNormalized: string;
    fullName: string | null;
  }) {
    const prisma = getPrismaClient();
    const customer = await prisma.customer.create({
      data: input,
    });

    return mapCustomer(customer);
  }

  async updateCustomerFullName(customerId: string, fullName: string) {
    const prisma = getPrismaClient();
    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: { fullName },
    });

    return mapCustomer(customer);
  }

  async createSession(input: {
    customerId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    const prisma = getPrismaClient();
    await prisma.customerSession.create({
      data: input,
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<CustomerSessionRecord | null> {
    const prisma = getPrismaClient();
    const session = await prisma.customerSession.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      customerId: session.customerId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      lastSeenAt: session.lastSeenAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      customer: mapCustomer(session.customer),
    };
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date) {
    const prisma = getPrismaClient();
    await prisma.customerSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }

  async touchSession(sessionId: string, lastSeenAt: Date) {
    const prisma = getPrismaClient();
    await prisma.customerSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { lastSeenAt },
    });
  }
}
