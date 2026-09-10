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

const DEFAULT_LIMIT = 10;

function loginRequest(ip: string) {
  return new Request("http://localhost/api/auth/admin/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ email: "admin@example.com", password: "secret" }),
  });
}

function stubSuccessfulLogin() {
  loginAdminMock.mockResolvedValue({
    sessionToken: "session_token",
    expiresAt: new Date("2026-06-10T00:00:00.000Z"),
    user: { id: "admin_1", name: "Daniel", email: "admin@example.com", role: "owner" },
  });
}

describe("POST /api/auth/admin/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetAllRateLimiters } = await import("@/shared/lib/rate-limit/rate-limit");
    resetAllRateLimiters();
    cookiesMock.mockResolvedValue({
      set: vi.fn(),
    });
  });

  it("allows a full shift change from the same IP before limiting", async () => {
    stubSuccessfulLogin();

    const { POST } = await import("./route");

    for (let i = 0; i < DEFAULT_LIMIT; i += 1) {
      const response = await POST(loginRequest("203.0.113.10"));
      expect(response.status).toBe(200);
    }
  });

  it("blocks the attempt after the default limit with 429 and Retry-After", async () => {
    stubSuccessfulLogin();

    const { POST } = await import("./route");

    for (let i = 0; i < DEFAULT_LIMIT; i += 1) {
      await POST(loginRequest("198.51.100.20"));
    }

    const blocked = await POST(loginRequest("198.51.100.20"));
    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(loginAdminMock).toHaveBeenCalledTimes(DEFAULT_LIMIT);
  });

  it("honours ADMIN_LOGIN_RATE_LIMIT", async () => {
    stubSuccessfulLogin();
    vi.resetModules();
    vi.stubEnv("ADMIN_LOGIN_RATE_LIMIT", "2");

    try {
      const { POST } = await import("./route");

      expect((await POST(loginRequest("192.0.2.30"))).status).toBe(200);
      expect((await POST(loginRequest("192.0.2.30"))).status).toBe(200);
      expect((await POST(loginRequest("192.0.2.30"))).status).toBe(429);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
