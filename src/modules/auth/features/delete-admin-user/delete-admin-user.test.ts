import { describe, expect, it } from "vitest";

import { InMemoryAdminAuthRepository } from "@/modules/auth/adapters/in-memory-admin-auth-repository";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import type { AdminUserRecord } from "@/modules/auth/domain/admin-auth.types";

import { deleteAdminUser } from "./delete-admin-user";

function seedUser(role: AdminUserRecord["role"], id = "user_2"): AdminUserRecord {
  return {
    id,
    name: `Usuario ${id}`,
    email: `${id}@oneburger.local`,
    passwordHash: "hash",
    role,
  };
}

describe("deleteAdminUser", () => {
  it("lets the owner revoke another admin account", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.kitchen),
    ]);

    const result = await deleteAdminUser(
      { userId: "user_2" },
      { repository, actorRole: ADMIN_ROLES.owner, actorUserId: "user_1" },
    );

    expect(result.data).toEqual({ id: "user_2" });
    expect(repository.users.map((user) => user.id)).toEqual(["user_1"]);
  });

  it("closes the open sessions of the revoked account", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.kitchen),
    ]);
    await repository.createSession({
      tokenHash: "token-hash",
      userId: "user_2",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await deleteAdminUser(
      { userId: "user_2" },
      { repository, actorRole: ADMIN_ROLES.owner, actorUserId: "user_1" },
    );

    expect(repository.sessions).toHaveLength(0);
  });

  it("forbids non-owner roles without deleting anything", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.kitchen),
    ]);

    for (const actorRole of [ADMIN_ROLES.manager, ADMIN_ROLES.kitchen]) {
      await expect(
        deleteAdminUser(
          { userId: "user_2" },
          { repository, actorRole, actorUserId: "user_9" },
        ),
      ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    }

    expect(repository.users).toHaveLength(2);
  });

  it("returns 404 when the target user does not exist", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
    ]);

    await expect(
      deleteAdminUser(
        { userId: "missing" },
        { repository, actorRole: ADMIN_ROLES.owner, actorUserId: "user_1" },
      ),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("refuses to delete your own account", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
      seedUser(ADMIN_ROLES.owner, "user_2"),
    ]);

    await expect(
      deleteAdminUser(
        { userId: "user_1" },
        { repository, actorRole: ADMIN_ROLES.owner, actorUserId: "user_1" },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });

    expect(repository.users).toHaveLength(2);
  });

  it("refuses to delete the last owner", async () => {
    const repository = new InMemoryAdminAuthRepository([
      seedUser(ADMIN_ROLES.owner, "user_1"),
    ]);

    await expect(
      deleteAdminUser(
        { userId: "user_1" },
        { repository, actorRole: ADMIN_ROLES.owner, actorUserId: "user_2" },
      ),
    ).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });

    expect(repository.users).toHaveLength(1);
  });
});
