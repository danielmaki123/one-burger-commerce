import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/shared/lib/auth/password-hasher";

const ADMIN_QA_EMAIL = "admin.qa.staging@one-burger.local";
const ADMIN_QA_NAME = "Admin QA Staging Temp";
const ADMIN_QA_ROLE = "owner" as const;
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-";

type Source = "internal_api";

export type StagingAdminQaAction = "create" | "delete";

export type RunStagingAdminQaInput = {
  action: StagingAdminQaAction;
  source: Source;
};

export type RunStagingAdminQaResult =
  | {
      status: "ok";
      source: Source;
      action: "create";
      email: string;
      role: typeof ADMIN_QA_ROLE;
      createdOrUpdated: true;
      tempPassword: string;
    }
  | {
      status: "ok";
      source: Source;
      action: "delete";
      email: string;
      deletedUser: boolean;
      deletedSessions: number;
    };

function assertStagingEnvironment() {
  if (process.env.APP_ENV !== "staging") {
    throw new Error("STAGING_ONLY_OPERATION");
  }
}

function buildRandomPassword(length = 28) {
  const bytes = randomBytes(length);
  let out = "";

  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  }

  return out;
}

async function createOrUpdateAdmin(prisma: PrismaClient, source: Source) {
  const tempPassword = buildRandomPassword();
  const passwordHash = hashPassword(tempPassword);

  await prisma.adminUser.upsert({
    where: { email: ADMIN_QA_EMAIL },
    update: {
      name: ADMIN_QA_NAME,
      role: ADMIN_QA_ROLE,
      passwordHash,
    },
    create: {
      email: ADMIN_QA_EMAIL,
      name: ADMIN_QA_NAME,
      role: ADMIN_QA_ROLE,
      passwordHash,
    },
  });

  return {
    status: "ok" as const,
    source,
    action: "create" as const,
    email: ADMIN_QA_EMAIL,
    role: ADMIN_QA_ROLE,
    createdOrUpdated: true as const,
    tempPassword,
  };
}

async function deleteAdmin(prisma: PrismaClient, source: Source) {
  const existingUser = await prisma.adminUser.findUnique({
    where: { email: ADMIN_QA_EMAIL },
    select: { id: true },
  });

  if (!existingUser) {
    return {
      status: "ok" as const,
      source,
      action: "delete" as const,
      email: ADMIN_QA_EMAIL,
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
    action: "delete" as const,
    email: ADMIN_QA_EMAIL,
    deletedUser: true,
    deletedSessions: deletedSessions.count,
  };
}

export async function runStagingAdminQa(
  input: RunStagingAdminQaInput,
): Promise<RunStagingAdminQaResult> {
  assertStagingEnvironment();

  const prisma = new PrismaClient();

  try {
    if (input.action === "create") {
      return await createOrUpdateAdmin(prisma, input.source);
    }

    return await deleteAdmin(prisma, input.source);
  } finally {
    await prisma.$disconnect();
  }
}
