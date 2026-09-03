import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  startOutboxProcessorScheduler,
  stopOutboxProcessorSchedulerForTests,
} from "./outbox-processor-scheduler";

describe("outbox processor scheduler", () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();
  const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    infoSpy.mockClear();
    errorSpy.mockClear();
    stopOutboxProcessorSchedulerForTests();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    stopOutboxProcessorSchedulerForTests();
    process.env = { ...originalEnv };
  });

  it("does not start when processor is disabled", async () => {
    process.env.OUTBOX_PROCESSOR_ENABLED = "false";
    process.env.OUTBOX_PROCESSOR_SECRET = "secret";

    const state = startOutboxProcessorScheduler();

    await vi.advanceTimersByTimeAsync(20000);

    expect(state.started).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not start when no deliverable sender is configured", async () => {
    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "secret";
    process.env.NOTIFICATIONS_DRIVER = "dummy";

    const state = startOutboxProcessorScheduler();

    await vi.advanceTimersByTimeAsync(20000);

    expect(state.started).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("auto-triggers the internal processor when enabled", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "super-secret";
    process.env.NOTIFICATIONS_DRIVER = "n8n_webhook";
    process.env.N8N_WEBHOOK_BASE_URL = "https://n8n.example.com/webhook";
    process.env.N8N_WEBHOOK_SECRET = "n8n-secret";
    process.env.PORT = "3000";
    process.env.OUTBOX_PROCESSOR_SCHEDULE_MS = "5000";

    startOutboxProcessorScheduler();

    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/internal/outbox/process",
      expect.objectContaining({
        method: "POST",
        headers: { "x-outbox-processor-secret": "super-secret" },
        cache: "no-store",
      }),
    );
  });

  it("starts only once per process", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });

    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.OUTBOX_PROCESSOR_ENABLED = "true";
    process.env.OUTBOX_PROCESSOR_SECRET = "super-secret";
    process.env.NOTIFICATIONS_DRIVER = "n8n_webhook";
    process.env.N8N_WEBHOOK_BASE_URL = "https://n8n.example.com/webhook";
    process.env.N8N_WEBHOOK_SECRET = "n8n-secret";
    process.env.OUTBOX_PROCESSOR_SCHEDULE_MS = "5000";

    const first = startOutboxProcessorScheduler();
    const second = startOutboxProcessorScheduler();

    await vi.advanceTimersByTimeAsync(5000);

    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
