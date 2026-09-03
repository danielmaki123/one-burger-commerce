import { beforeEach, describe, expect, it, vi } from "vitest";

const runStagingAdminQaMock = vi.fn();

vi.mock("../../../../../../scripts/staging-admin-qa-core", () => ({
  runStagingAdminQa: runStagingAdminQaMock,
}));

describe("POST /api/internal/staging/admin-qa", () => {
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
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      headers: { "x-staging-admin-qa-token": "secret" },
      body: JSON.stringify({ action: "create" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when token env is missing", async () => {
    process.env.APP_ENV = "staging";
    delete process.env.STAGING_ADMIN_QA_TOKEN;

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      body: JSON.stringify({ action: "create" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token header is missing", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      body: JSON.stringify({ action: "create" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token is invalid", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "correct-secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      headers: { "x-staging-admin-qa-token": "wrong-secret" },
      body: JSON.stringify({ action: "create" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 on invalid payload", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      headers: { "x-staging-admin-qa-token": "secret" },
      body: JSON.stringify({ action: "invalid" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 200 on successful create", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    runStagingAdminQaMock.mockResolvedValueOnce({
      status: "ok",
      source: "internal_api",
      action: "create",
      email: "admin.qa.staging@one-burger.local",
      role: "owner",
      createdOrUpdated: true,
      tempPassword: "abc123",
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      headers: { "x-staging-admin-qa-token": "secret" },
      body: JSON.stringify({ action: "create" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(body.data.action).toBe("create");
    expect(runStagingAdminQaMock).toHaveBeenCalledWith({
      action: "create",
      source: "internal_api",
    });
  });

  it("returns 200 on successful delete", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "secret";

    runStagingAdminQaMock.mockResolvedValueOnce({
      status: "ok",
      source: "internal_api",
      action: "delete",
      email: "admin.qa.staging@one-burger.local",
      deletedUser: true,
      deletedSessions: 1,
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      headers: { "x-staging-admin-qa-token": "secret" },
      body: JSON.stringify({ action: "delete" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(body.data.action).toBe("delete");
    expect(runStagingAdminQaMock).toHaveBeenCalledWith({
      action: "delete",
      source: "internal_api",
    });
  });

  it("does not leak secrets in error responses", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_ADMIN_QA_TOKEN = "super-secret-123";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/admin-qa", {
      method: "POST",
      headers: { "x-staging-admin-qa-token": "wrong" },
      body: JSON.stringify({ action: "create" }),
    });
    const response = await POST(request);
    const text = await response.text();

    expect(text).not.toContain("super-secret-123");
  });
});
