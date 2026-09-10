import { describe, expect, it } from "vitest";

import { InMemoryAdminAuthRepository } from "@/modules/auth/adapters/in-memory-admin-auth-repository";
import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";
import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { verifyPassword } from "@/shared/lib/auth/password-hasher";

import { createAdminUser } from "./create-admin-user";

function createRepository(existing: AdminUserRecord[] = []) {
  return new InMemoryAdminAuthRepository(existing);
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
