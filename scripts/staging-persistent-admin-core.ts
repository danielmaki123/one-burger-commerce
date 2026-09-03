import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/shared/lib/auth/password-hasher";

type Source = "internal_api";

export type PersistentAdminAction = "upsert" | "disable";

export type RunPersistentAdminInput = {
  action: PersistentAdminAction;
  source: Source;
};

export type RunPersistentAdminResult =
  | {
      status: "ok";
      source: Source;
      action: "upsert";
      email: string;
      role: string;
      outcome: "created" | "updated";
    }
  | {
      status: "ok";
      source: Source;
      action: "disable";
      email: string;
      deletedUser: boolean;
      deletedSessions: number;
    };

function assertStagingEnvironment() {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("STAGING_ONLY_OPERATION");
  }
}

function getAdminConfig() {
  const email = process.env.STAGING_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.STAGING_ADMIN_PASSWORD;
  const name = process.env.STAGING_ADMIN_NAME?.trim() || "Daniel Chavarria";
  const role = process.env.STAGING_ADMIN_ROLE?.trim() || "owner";

  if (!email || !password) {
    throw new Error("STAGING_ADMIN_CONFIG_MISSING");
  }

  return { email, password, name, role };
}

async function upsertPersistentAdmin(
  prisma: PrismaClient,
  source: Source,
): Promise<RunPersistentAdminResult> {
  const config = getAdminConfig();
  const passwordHash = hashPassword(config.password);

  const existing = await prisma.adminUser.findUnique({
    where: { email: config.email },
    select: { id: true },
  });

  await prisma.adminUser.upsert({
    where: { email: config.email },
    update: {
      name: config.name,
      role: config.role as "owner" | "manager" | "kitchen",
      passwordHash,
    },
    create: {
      email: config.email,
      name: config.name,
      role: config.role as "owner" | "manager" | "kitchen",
      passwordHash,
    },
  });

  return {
    status: "ok" as const,
    source,
    action: "upsert" as const,
    email: config.email,
    role: config.role,
    outcome: existing ? "updated" : "created",
  };
}

async function disablePersistentAdmin(
  prisma: PrismaClient,
  source: Source,
): Promise<RunPersistentAdminResult> {
  const config = getAdminConfig();

  const existingUser = await prisma.adminUser.findUnique({
    where: { email: config.email },
    select: { id: true },
  });

  if (!existingUser) {
    return {
      status: "ok" as const,
      source,
      action: "disable" as const,
      email: config.email,
      deletedUser: false,
      deletedSessions: 0,
    };
  }

  const deletedSessions = await prisma.adminSession.deleteMany({
    where: { userId: existingUser.id },
  });

  await prisma.adminUser.delete({
    where: { id: existingUser.id },
  });

  return {
    status: "ok" as const,
    source,
    action: "disable" as const,
    email: config.email,
    deletedUser: true,
    deletedSessions: deletedSessions.count,
  };
}

export async function runPersistentAdmin(
  input: RunPersistentAdminInput,
): Promise<RunPersistentAdminResult> {
  assertStagingEnvironment();

  const prisma = new PrismaClient();

  try {
    if (input.action === "upsert") {
      return await upsertPersistentAdmin(prisma, input.source);
    }

    return await disablePersistentAdmin(prisma, input.source);
  } finally {
    await prisma.$disconnect();
  }
}
