import { beforeEach, describe, expect, it, vi } from "vitest";

const runPersistentAdminMock = vi.fn();

vi.mock("../../../../../../scripts/staging-persistent-admin-core", () => ({
  runPersistentAdmin: runPersistentAdminMock,
}));

describe("POST /api/internal/staging/persistent-admin", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  });

  it("returns 403 when APP_ENV is not staging", async () => {
    process.env.APP_ENV = "production";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        headers: { "x-staging-admin-qa-token": "secret" },
        body: JSON.stringify({ action: "upsert" }),
      },
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when STAGING_ADMIN_QA_TOKEN is missing", async () => {
    process.env.APP_ENV = "staging";
    delete process.env.STAGING_ADMIN_QA_TOKEN;

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        body: JSON.stringify({ action: "upsert" }),
      },
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token is missing", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        body: JSON.stringify({ action: "upsert" }),
      },
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token is invalid", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "correct-secret";

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        headers: { "x-staging-admin-qa-token": "wrong-secret" },
        body: JSON.stringify({ action: "upsert" }),
      },
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 500 when staging admin config is missing", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";
    delete process.env.STAGING_ADMIN_EMAIL;
    delete process.env.STAGING_ADMIN_PASSWORD;

    runPersistentAdminMock.mockRejectedValue(
      new Error("STAGING_ADMIN_CONFIG_MISSING"),
    );

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        headers: { "x-staging-admin-qa-token": "secret" },
        body: JSON.stringify({ action: "upsert" }),
      },
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("SERVER_MISCONFIGURATION");
  });

  it("returns 200 on successful upsert", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    runPersistentAdminMock.mockResolvedValueOnce({
      status: "ok",
      source: "internal_api",
      action: "upsert",
      email: "daniel@example.com",
      role: "owner",
      outcome: "created",
    });

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        headers: { "x-staging-admin-qa-token": "secret" },
        body: JSON.stringify({ action: "upsert" }),
      },
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(body.data.action).toBe("upsert");
    expect(body.data.outcome).toBe("created");
    expect(runPersistentAdminMock).toHaveBeenCalledWith({
      action: "upsert",
      source: "internal_api",
    });
  });

  it("does not leak secrets in error responses", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "super-secret-123";

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        headers: { "x-staging-admin-qa-token": "wrong" },
        body: JSON.stringify({ action: "upsert" }),
      },
    );
    const response = await POST(request);
    const text = await response.text();

    expect(text).not.toContain("super-secret-123");
  });

  it("returns 400 on invalid payload action", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request(
      "http://localhost/api/internal/staging/persistent-admin",
      {
        method: "POST",
        headers: { "x-staging-admin-qa-token": "secret" },
        body: JSON.stringify({ action: "invalid" }),
      },
    );
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
