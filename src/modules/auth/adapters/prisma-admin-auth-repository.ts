import type { AdminRole } from "@/modules/auth/domain/admin-role";

import type {
  AdminSessionRecord,
  AdminUserRecord,
} from "@/modules/auth/domain/admin-auth.types";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";
import { getPrismaClient } from "@/infrastructure/database/prisma";

function mapUser(user: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
}): AdminUserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
  };
}

export class PrismaAdminAuthRepository implements AdminAuthRepository {
  async findUserByEmail(email: string) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    return user ? mapUser(user) : null;
  }

  async findUserById(id: string) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.findUnique({ where: { id } });

    return user ? mapUser(user) : null;
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: AdminRole;
  }) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.create({
      data: {
        ...input,
        email: input.email.toLowerCase(),
      },
    });

    return mapUser(user);
  }

  async listUsers() {
    const prisma = getPrismaClient();
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
    });

    return users.map(mapUser);
  }

  async updateUserRole(id: string, role: AdminRole) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.update({
      where: { id },
      data: { role },
    });

    return mapUser(user);
  }

  async updateUserPassword(id: string, passwordHash: string) {
    const prisma = getPrismaClient();
    await prisma.adminUser.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async deleteUser(id: string) {
    const prisma = getPrismaClient();
    // AdminSession has onDelete: Cascade, so revoking the account also kills
    // every open session for that user.
    await prisma.adminUser.delete({ where: { id } });
  }

  async createSession(input: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }) {
    const prisma = getPrismaClient();
    await prisma.adminSession.create({
      data: input,
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<AdminSessionRecord | null> {
    const prisma = getPrismaClient();
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      userId: session.userId,
      user: mapUser(session.user),
    };
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    const prisma = getPrismaClient();
    await prisma.adminSession.deleteMany({
      where: { tokenHash },
    });
  }
}

