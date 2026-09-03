import { beforeEach, describe, expect, it, vi } from "vitest";

const runStagingSeedMock = vi.fn();

vi.mock("../../../../../../scripts/staging-seed-core", () => ({
  runStagingSeed: runStagingSeedMock,
}));

describe("POST /api/internal/staging/seed", () => {
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
    process.env.STAGING_SEED_RUN_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/seed", {
      method: "POST",
      headers: { "x-staging-seed-token": "secret" },
      body: JSON.stringify({ dryRun: true }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when token env is missing", async () => {
    process.env.APP_ENV = "staging";
    delete process.env.STAGING_SEED_RUN_TOKEN;

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/seed", {
      method: "POST",
      body: JSON.stringify({ dryRun: true }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token header is missing", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_SEED_RUN_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/seed", {
      method: "POST",
      body: JSON.stringify({ dryRun: true }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when token is invalid", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_SEED_RUN_TOKEN = "correct-secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/seed", {
      method: "POST",
      headers: { "x-staging-seed-token": "wrong-secret" },
      body: JSON.stringify({ dryRun: true }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 on invalid payload", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_SEED_RUN_TOKEN = "secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/seed", {
      method: "POST",
      headers: { "x-staging-seed-token": "secret" },
      body: JSON.stringify({ dryRun: "not-a-boolean" }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 200 on successful seed", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_SEED_RUN_TOKEN = "secret";

    runStagingSeedMock.mockResolvedValueOnce({
      status: "ok",
      source: "internal_api",
      dryRun: false,
      plan: {},
      simulatedOrApplied: {},
      current: null,
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/seed", {
      method: "POST",
      headers: { "x-staging-seed-token": "secret" },
      body: JSON.stringify({ dryRun: false }),
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe("ok");
    expect(runStagingSeedMock).toHaveBeenCalledWith({
      dryRun: false,
      source: "internal_api",
    });
  });

  it("does not leak secrets in error responses", async () => {
    process.env.APP_ENV = "staging";
    process.env.STAGING_SEED_RUN_TOKEN = "super-secret-123";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/staging/seed", {
      method: "POST",
      headers: { "x-staging-seed-token": "wrong" },
      body: JSON.stringify({ dryRun: true }),
    });
    const response = await POST(request);
    const text = await response.text();

    expect(text).not.toContain("super-secret-123");
  });
});
