import { describe, expect, it } from "vitest";

import { InMemoryAdminAuthRepository } from "@/modules/auth/adapters/in-memory-admin-auth-repository";
import { ADMIN_ROLES } from "@/modules/auth/domain/admin-role";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { loginAdmin } from "@/modules/auth/features/login-admin/login-admin";
import { hashPassword } from "@/shared/lib/auth/password-hasher";

function createRepository() {
  return new InMemoryAdminAuthRepository([
    {
      id: "user_01",
      name: "Admin",
      email: "admin@oneburger.local",
      passwordHash: hashPassword("secret123"),
      role: ADMIN_ROLES.owner,
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
});
