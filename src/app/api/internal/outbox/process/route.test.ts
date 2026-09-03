import { beforeEach, describe, expect, it, vi } from "vitest";

const processOutboxEventsMock = vi.fn();
const createNotificationSenderFromEnvMock = vi.fn();
const hasDeliverableNotificationSenderFromEnvMock = vi.fn();
const registerOutboxEventBusHandlersMock = vi.fn();

vi.mock("@/modules/notifications/features/process-outbox-events/process-outbox-events", () => ({
  processOutboxEvents: processOutboxEventsMock,
}));

vi.mock("@/modules/notifications/adapters/notification-sender-factory", () => ({
  createNotificationSenderFromEnv: createNotificationSenderFromEnvMock,
  hasDeliverableNotificationSenderFromEnv:
    hasDeliverableNotificationSenderFromEnvMock,
}));

vi.mock("@/modules/notifications/adapters/outbox-subscriber", () => ({
  registerOutboxEventBusHandlers: registerOutboxEventBusHandlersMock,
}));

vi.mock("@/modules/notifications/adapters/prisma-outbox-repository", () => ({
  PrismaOutboxRepository: vi.fn(),
}));

describe("POST /api/internal/outbox/process", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    hasDeliverableNotificationSenderFromEnvMock.mockReturnValue(true);
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
  });

  it("returns 403 when processor is disabled", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "false";
    process.env.OUTBOX_PROCESSOR_SECRET = "secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/outbox/process", {
      method: "POST",
      headers: { "x-outbox-processor-secret": "secret" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when processor secret is not configured", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    delete process.env.OUTBOX_PROCESSOR_SECRET;

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/outbox/process", {
      method: "POST",
      headers: { "x-outbox-processor-secret": "any" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when processor secret is invalid", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "correct-secret";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/outbox/process", {
      method: "POST",
      headers: { "x-outbox-processor-secret": "wrong-secret" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 412 when no deliverable sender is configured", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "correct-secret";
    hasDeliverableNotificationSenderFromEnvMock.mockReturnValue(false);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/outbox/process", {
      method: "POST",
      headers: { "x-outbox-processor-secret": "correct-secret" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(412);
    expect(body.error.code).toBe("FAILED_PRECONDITION");
    expect(processOutboxEventsMock).not.toHaveBeenCalled();
  });

  it("returns 412 when cutoff env is invalid", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "correct-secret";
    process.env.OUTBOX_PROCESSOR_MIN_CREATED_AT = "not-a-date";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/outbox/process", {
      method: "POST",
      headers: { "x-outbox-processor-secret": "correct-secret" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(412);
    expect(body.error.code).toBe("FAILED_PRECONDITION");
    expect(processOutboxEventsMock).not.toHaveBeenCalled();
  });

  it("returns 200 and processes events when authorized", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "correct-secret";
    process.env.OUTBOX_PROCESSOR_BATCH_SIZE = "5";
    process.env.OUTBOX_PROCESSOR_MAX_ATTEMPTS = "5";
    process.env.OUTBOX_PROCESSOR_ALLOWED_EVENT_TYPES =
      "OrderCreated, ReservationCreated";
    process.env.OUTBOX_PROCESSOR_MIN_CREATED_AT =
      "2026-06-24T22:00:00.000Z";

    processOutboxEventsMock.mockResolvedValueOnce({
      data: { processed: 2, failed: 0 },
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/outbox/process", {
      method: "POST",
      headers: { "x-outbox-processor-secret": "correct-secret" },
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.processed).toBe(2);
    expect(body.data.failed).toBe(0);
    expect(processOutboxEventsMock).toHaveBeenCalledWith(
      {
        batchSize: 5,
        maxAttempts: 5,
        allowedEventTypes: ["OrderCreated", "ReservationCreated"],
        minCreatedAt: "2026-06-24T22:00:00.000Z",
      },
      expect.any(Object),
    );
  });

  it("does not leak secrets in error responses", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "super-secret-123";

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/internal/outbox/process", {
      method: "POST",
      headers: { "x-outbox-processor-secret": "wrong" },
    });
    const response = await POST(request);
    const text = await response.text();

    expect(text).not.toContain("super-secret-123");
  });
});
