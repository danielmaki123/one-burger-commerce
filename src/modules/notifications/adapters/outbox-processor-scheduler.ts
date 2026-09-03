import { hasDeliverableNotificationSenderFromEnv } from "@/modules/notifications/adapters/notification-sender-factory";

const DEFAULT_INTERVAL_MS = 15000;
const INITIAL_DELAY_MS = 5000;
const MIN_INTERVAL_MS = 5000;

type SchedulerState = {
  intervalId: ReturnType<typeof setInterval> | null;
  initialTimeoutId: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  started: boolean;
};

declare global {
  var __caOutboxProcessorScheduler: SchedulerState | undefined;
}

function getSchedulerState(): SchedulerState {
  if (!globalThis.__caOutboxProcessorScheduler) {
    globalThis.__caOutboxProcessorScheduler = {
      intervalId: null,
      initialTimeoutId: null,
      inFlight: false,
      started: false,
    };
  }

  return globalThis.__caOutboxProcessorScheduler;
}

function parseIntervalMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_INTERVAL_MS;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return DEFAULT_INTERVAL_MS;

  return Math.max(parsed, MIN_INTERVAL_MS);
}

function shouldStartScheduler() {
  return (
    process.env.NODE_ENV !== "test" &&
    process.env.OUTBOX_PROCESSOR_ENABLED === "true" &&
    Boolean(process.env.OUTBOX_PROCESSOR_SECRET) &&
    hasDeliverableNotificationSenderFromEnv()
  );
}

function buildProcessorUrl() {
  const baseUrl =
    process.env.OUTBOX_PROCESSOR_INTERNAL_URL?.trim() ||
    `http://127.0.0.1:${process.env.PORT ?? "3000"}`;

  return `${baseUrl.replace(/\/$/, "")}/api/internal/outbox/process`;
}

async function triggerOutboxProcessor() {
  const secret = process.env.OUTBOX_PROCESSOR_SECRET;
  if (!secret) {
    throw new Error("Outbox processor secret missing");
  }

  const response = await fetch(buildProcessorUrl(), {
    method: "POST",
    headers: {
      "x-outbox-processor-secret": secret,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const body = await response.text().catch(() => "");
  const safeBody = body.replaceAll(secret, "[REDACTED]");
  throw new Error(
    `Outbox processor auto-trigger failed (${response.status})${
      safeBody ? `: ${safeBody.slice(0, 200)}` : ""
    }`,
  );
}

export function startOutboxProcessorScheduler() {
  const state = getSchedulerState();
  if (state.started || !shouldStartScheduler()) {
    return state;
  }

  const runTick = async () => {
    if (state.inFlight) {
      return;
    }

    state.inFlight = true;
    try {
      await triggerOutboxProcessor();
    } catch (error) {
      console.error(
        "[outbox-processor-scheduler] tick failed:",
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      state.inFlight = false;
    }
  };

  const intervalMs = parseIntervalMs(process.env.OUTBOX_PROCESSOR_SCHEDULE_MS);

  state.started = true;
  state.initialTimeoutId = setTimeout(() => {
    void runTick();
    state.intervalId = setInterval(() => {
      void runTick();
    }, intervalMs);
  }, INITIAL_DELAY_MS);

  console.info(
    `[outbox-processor-scheduler] enabled intervalMs=${intervalMs} processorUrl=${buildProcessorUrl()}`,
  );

  return state;
}

export function stopOutboxProcessorSchedulerForTests() {
  const state = getSchedulerState();

  if (state.initialTimeoutId) {
    clearTimeout(state.initialTimeoutId);
  }
  if (state.intervalId) {
    clearInterval(state.intervalId);
  }

  globalThis.__caOutboxProcessorScheduler = {
    intervalId: null,
    initialTimeoutId: null,
    inFlight: false,
    started: false,
  };
}
