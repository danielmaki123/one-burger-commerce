import { scryptSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { InMemoryAdminAuthRepository } from "@/modules/auth/adapters/in-memory-admin-auth-repository";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { loginAdmin } from "@/modules/auth/features/login-admin/login-admin";
import {
  SCRYPT_PARAMS,
  hashPassword,
  passwordNeedsRehash,
} from "@/shared/lib/auth/password-hasher";

function createRepository() {
  return new InMemoryAdminAuthRepository([
    {
      id: "user_01",
      name: "Admin",
      email: "admin@oneburger.local",
      passwordHash: hashPassword("secret123"),
      role: ADMIN_ROLES.owner,
      locationIds: [],
    },
  ]);
}

/** El hash del formato viejo: `salt:digest`, sin parámetros guardados. */
function legacyHash(password: string, salt = "aabbccddeeff00112233445566778899") {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function createLegacyRepository() {
  return new InMemoryAdminAuthRepository([
    {
      id: "user_01",
      name: "Admin viejo",
      email: "admin@oneburger.local",
      passwordHash: legacyHash("secret123"),
      role: ADMIN_ROLES.owner,
      locationIds: [],
    },
  ]);
}

describe("loginAdmin", () => {
  it("creates an admin session for valid credentials", async () => {
    const result = await loginAdmin(
      {
        email: "admin@oneburger.local",
        password: "secret123",
      },
      { repository: createRepository(), now: new Date("2026-05-14T00:00:00.000Z") },
    );

    expect(result.user.role).toBe(ADMIN_ROLES.owner);
    expect(result.sessionToken.length).toBeGreaterThan(10);
  });

  it("rejects invalid credentials", async () => {
    await expect(
      loginAdmin(
        {
          email: "admin@oneburger.local",
          password: "wrong-password",
        },
        { repository: createRepository() },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("actualiza el hash viejo al entrar, sin pedirle nada al usuario", async () => {
    const repository = createLegacyRepository();
    const legacy = repository.users[0].passwordHash;
    expect(passwordNeedsRehash(legacy)).toBe(true);

    await loginAdmin(
      { email: "admin@oneburger.local", password: "secret123" },
      { repository },
    );

    const updated = repository.users[0].passwordHash;
    expect(updated).not.toBe(legacy);
    expect(updated.startsWith(`scrypt$${SCRYPT_PARAMS.N}$`)).toBe(true);
    expect(passwordNeedsRehash(updated)).toBe(false);

    // Y la próxima entrada sigue funcionando con la misma contraseña.
    await expect(
      loginAdmin({ email: "admin@oneburger.local", password: "secret123" }, { repository }),
    ).resolves.toBeTruthy();
  });

  it("no toca el hash que ya está al día", async () => {
    const repository = createRepository();
    const before = repository.users[0].passwordHash;

    await loginAdmin(
      { email: "admin@oneburger.local", password: "secret123" },
      { repository },
    );

    expect(repository.users[0].passwordHash).toBe(before);
  });

  it("si la actualización del hash falla, el login igual entra", async () => {
    // Una cuenta que puede entrar no se queda afuera porque falle una mejora interna.
    const repository = createLegacyRepository();
    repository.updateUserPassword = async () => {
      throw new Error("base caída");
    };

    const result = await loginAdmin(
      { email: "admin@oneburger.local", password: "secret123" },
      { repository },
    );

    expect(result.user.email).toBe("admin@oneburger.local");
  });
});
