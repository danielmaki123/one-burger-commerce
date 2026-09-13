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
  locations?: { locationId: string }[];
}): AdminUserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    // El orden es el de la selección en el formulario (que sigue el orden de los locales).
    locationIds: (user.locations ?? []).map((location) => location.locationId),
  };
}

/** Las asignaciones viajan siempre con el usuario: el alcance de pedidos las necesita en la sesión. */
const USER_WITH_LOCATIONS = {
  locations: { select: { locationId: true }, orderBy: { createdAt: "asc" } },
} as const;

export class PrismaAdminAuthRepository implements AdminAuthRepository {
  async findUserByEmail(email: string) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
      include: USER_WITH_LOCATIONS,
    });

    return user ? mapUser(user) : null;
  }

  async findUserById(id: string) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.findUnique({
      where: { id },
      include: USER_WITH_LOCATIONS,
    });

    return user ? mapUser(user) : null;
  }

  async createUser(input: {
    name: string;
    email: string;
    passwordHash: string;
    role: AdminRole;
    locationIds?: string[];
  }) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role,
        locations: input.locationIds?.length
          ? { create: input.locationIds.map((locationId) => ({ locationId })) }
          : undefined,
      },
      include: USER_WITH_LOCATIONS,
    });

    return mapUser(user);
  }

  async listUsers() {
    const prisma = getPrismaClient();
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      include: USER_WITH_LOCATIONS,
    });

    return users.map(mapUser);
  }

  async updateUserRole(id: string, role: AdminRole) {
    const prisma = getPrismaClient();
    const user = await prisma.adminUser.update({
      where: { id },
      data: { role },
      include: USER_WITH_LOCATIONS,
    });

    return mapUser(user);
  }

  async setUserLocations(id: string, locationIds: string[]) {
    const prisma = getPrismaClient();

    // Guardado completo en una transacción: si falla la inserción, no se pierden las anteriores.
    await prisma.$transaction([
      prisma.adminUserLocation.deleteMany({ where: { adminUserId: id } }),
      prisma.adminUserLocation.createMany({
        data: locationIds.map((locationId) => ({ adminUserId: id, locationId })),
      }),
    ]);

    const user = await prisma.adminUser.findUnique({
      where: { id },
      include: USER_WITH_LOCATIONS,
    });

    if (!user) {
      throw new Error(`Admin user ${id} not found`);
    }

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
      // Las asignaciones viajan con la sesión: el alcance de pedidos se resuelve en cada request.
      include: { user: { include: USER_WITH_LOCATIONS } },
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

