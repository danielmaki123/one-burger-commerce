import { describe, expect, it } from "vitest";

import { InMemoryAdminAuthRepository } from "@/modules/auth/adapters/in-memory-admin-auth-repository";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";

import { updateAdminUserRole } from "./update-admin-user-role";

function seedUser(role: AdminUserRecord["role"], id = "user_2"): AdminUserRecord {
  return {
    id,
    name: `Usuario ${id}`,
    email: `${id}@oneburger.local`,
    passwordHash: "hash",
    role,
  };
}

describe("updateAdminUserRole", () => {
  it("lets the owner change another user's role", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.kitchen),
    ]);

    const result = await updateAdminUserRole(
      { userId: "user_2", role: ADMIN_ROLES.manager },
      { repository, actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data).toEqual({
      id: "user_2",
      name: "Usuario user_2",
      email: "user_2@oneburger.local",
      role: ADMIN_ROLES.manager,
    });
    expect(repository.users.find((user) => user.id === "user_2")?.role).toBe(
      ADMIN_ROLES.manager,
    );
  });

  it("never returns the password hash", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.kitchen),
    ]);

    const result = await updateAdminUserRole(
      { userId: "user_2", role: ADMIN_ROLES.manager },
      { repository, actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data).not.toHaveProperty("passwordHash");
  });

  it("forbids non-owner roles without changing anything", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.kitchen),
    ]);

    for (const actorRole of [ADMIN_ROLES.manager, ADMIN_ROLES.kitchen]) {
      await expect(
        updateAdminUserRole(
          { userId: "user_2", role: ADMIN_ROLES.owner },
          { repository, actorRole },
        ),
      ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    }

    expect(repository.users.find((user) => user.id === "user_2")?.role).toBe(
      ADMIN_ROLES.kitchen,
    );
  });

  it("returns 404 when the target user does not exist", async () => {
    const repository = new InMemoryAdminAuthRepository();

    await expect(
      updateAdminUserRole(
        { userId: "missing", role: ADMIN_ROLES.manager },
        { repository, actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("refuses to remove the last owner so the restaurant cannot lock itself out", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
    ]);

    await expect(
      updateAdminUserRole(
        { userId: "user_1", role: ADMIN_ROLES.manager },
        { repository, actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });

    expect(repository.users.find((user) => user.id === "user_1")?.role).toBe(
      ADMIN_ROLES.owner,
    );
  });

  it("allows demoting an owner when another owner remains", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.owner, "user_2"),
    ]);

    const result = await updateAdminUserRole(
      { userId: "user_2", role: ADMIN_ROLES.manager },
      { repository, actorRole: ADMIN_ROLES.owner },
    );

    expect(result.data.role).toBe(ADMIN_ROLES.manager);
  });

  it("rejects invalid roles", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.kitchen),
    ]);

    await expect(
      updateAdminUserRole(
        { userId: "user_2", role: "superadmin" as never },
        { repository, actorRole: ADMIN_ROLES.owner },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });
});
