import { describe, expect, it } from "vitest";

import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import type { AdminAuthRepository } from "@/modules/auth/ports/admin-auth-repository";

import { listAdminUsers } from "./list-admin-users";

describe("listAdminUsers", () => {
  it("returns users without password hashes for owner", async () => {
    const repository = {
      async listUsers() {
        return [
          {
            id: "user_1",
            name: "Owner",
            email: "owner@oneburger.local",
            passwordHash: "secret",
            role: ADMIN_ROLES.owner,
          },
        ];
      },
    } as AdminAuthRepository;

    const result = await listAdminUsers({
      repository,
      actorRole: ADMIN_ROLES.owner,
    });

    expect(result.data).toEqual([
      {
        id: "user_1",
        name: "Owner",
        email: "owner@oneburger.local",
        role: ADMIN_ROLES.owner,
      },
    ]);
  });

  it("forbids non-owner roles", async () => {
    await expect(
      listAdminUsers({
        repository: { async listUsers() { return []; } } as unknown as AdminAuthRepository,
        actorRole: ADMIN_ROLES.manager,
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
