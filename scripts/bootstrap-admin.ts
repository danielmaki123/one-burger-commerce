import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/shared/lib/auth/password-hasher";
import { isAdminRole } from "../src/modules/auth/domain/admin-role";

const prisma = new PrismaClient();

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function validatePassword(password: string) {
  if (password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
  }
}

async function main() {
  const email = readRequiredEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = readRequiredEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Admin One Burger";
  const roleInput = process.env.BOOTSTRAP_ADMIN_ROLE?.trim() || "owner";

  if (!isAdminRole(roleInput)) {
    throw new Error("BOOTSTRAP_ADMIN_ROLE must be owner, manager, or kitchen.");
  }

  const role = roleInput;

  validatePassword(password);

  await prisma.adminUser.upsert({
    where: { email },
    update: {
      name,
      passwordHash: hashPassword(password),
      role,
    },
    create: {
      name,
      email,
      passwordHash: hashPassword(password),
      role,
    },
  });

  console.log(`Admin user ready: ${email} (${role})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
