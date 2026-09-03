import { beforeEach, describe, expect, it, vi } from "vitest";

const loginAdminMock = vi.fn();
const cookiesMock = vi.fn();
const repositoryCtorMock = vi.fn(
  function RepositoryMock(this: Record<string, never>) {
    return this;
  },
);

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: repositoryCtorMock,
}));

vi.mock("@/modules/auth/features/login-admin/login-admin", () => ({
  loginAdmin: loginAdminMock,
}));

vi.mock("@/shared/lib/rate-limit/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/rate-limit/rate-limit")>(
    "@/shared/lib/rate-limit/rate-limit",
  );
  return actual;
});

describe("POST /api/auth/admin/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetAllRateLimiters } = await import("@/shared/lib/rate-limit/rate-limit");
    resetAllRateLimiters();
    cookiesMock.mockResolvedValue({
      set: vi.fn(),
    });
  });

  it("permite hasta 5 intentos desde la misma IP", async () => {
    loginAdminMock.mockResolvedValue({
      sessionToken: "session_token",
      expiresAt: new Date("2026-06-10T00:00:00.000Z"),
      user: { id: "admin_1", name: "Daniel", email: "admin@example.com", role: "owner" },
    });

    const { POST } = await import("./route");

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(
        new Request("http://localhost/api/auth/admin/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.10",
          },
          body: JSON.stringify({ email: "admin@example.com", password: "secret" }),
        }),
      );

      expect(response.status).toBe(200);
    }
  });

  it("bloquea el sexto intento con 429 y Retry-After", async () => {
    loginAdminMock.mockResolvedValue({
      sessionToken: "session_token",
      expiresAt: new Date("2026-06-10T00:00:00.000Z"),
      user: { id: "admin_1", name: "Daniel", email: "admin@example.com", role: "owner" },
    });

    const { POST } = await import("./route");

    for (let i = 0; i < 5; i += 1) {
      await POST(
        new Request("http://localhost/api/auth/admin/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "198.51.100.20",
          },
          body: JSON.stringify({ email: "admin@example.com", password: "secret" }),
        }),
      );
    }

    const blocked = await POST(
      new Request("http://localhost/api/auth/admin/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.20",
        },
        body: JSON.stringify({ email: "admin@example.com", password: "secret" }),
      }),
    );

    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(loginAdminMock).toHaveBeenCalledTimes(5);
  });
});
