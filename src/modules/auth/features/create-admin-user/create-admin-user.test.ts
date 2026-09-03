import { describe, expect, it } from "vitest";

import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import type {
  AdminSessionRecord,
  AdminUserRecord,
} from "@/modules/auth/domain/admin-auth.types";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";
import { verifyPassword } from "@/shared/lib/auth/password-hasher";

import { createAdminUser } from "./create-admin-user";

function createRepository(existing: AdminUserRecord[] = []): AdminAuthRepository {
  const users = [...existing];

  return {
    async findUserByEmail(email) {
      return users.find((user) => user.email === email) ?? null;
    },
    async createUser(input) {
      const user = {
        id: `user_${users.length + 1}`,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
      };
      users.push(user);
      return user;
    },
    async listUsers() {
      return users;
    },
    async createSession() {},
    async findSessionByTokenHash(): Promise<AdminSessionRecord | null> {
      return null;
    },
    async deleteSessionByTokenHash() {},
  };
}

describe("createAdminUser", () => {
  it("creates a manager user when actor is owner", async () => {
    const repository = createRepository();

    const result = await createAdminUser(
      {
        name: "Turno",
        email: "turno@oneburger.local",
        password: "Admin1234!",
        role: ADMIN_ROLES.manager,
      },
      { repository, actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.email).toBe("turno@oneburger.local");
    expect(result.data.role).toBe(ADMIN_ROLES.manager);
    expect(result.data).not.toHaveProperty("passwordHash");

    const stored = await repository.findUserByEmail("turno@oneburger.local");
    expect(stored).not.toBeNull();
    expect(verifyPassword("Admin1234!", stored?.passwordHash ?? "")).toBe(true);
  });

  it.each([ADMIN_ROLES.manager, ADMIN_ROLES.kitchen] as AdminRole[])(
    "forbids %s from creating users",
    async (actorRole) => {
      await expect(
        createAdminUser(
          {
            name: "Cocina",
            email: "cocina@oneburger.local",
            password: "Admin1234!",
            role: ADMIN_ROLES.kitchen,
          },
          { repository: createRepository(), actorRole },
        ),
      ).rejects.toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    },
  );

  it("rejects duplicate emails", async () => {
    const repository = createRepository([
      {
        id: "user_1",
        name: "Owner",
        email: "owner@oneburger.local",
        passwordHash: "hash",
        role: ADMIN_ROLES.owner,
      },
    ]);

    await expect(
      createAdminUser(
        {
          name: "Owner Copy",
          email: "owner@oneburger.local",
          password: "Admin1234!",
          role: ADMIN_ROLES.manager,
        },
        { repository, actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toBeInstanceOf(AuthError);
  });
});
