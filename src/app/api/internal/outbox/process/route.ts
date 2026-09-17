import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { InMemoryDedupTracker } from "@/modules/notifications/adapters/in-memory-dedup-tracker";
import {
  createNotificationSenderFromEnv,
  hasDeliverableNotificationSenderFromEnv,
} from "@/modules/notifications/adapters/notification-sender-factory";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { processOutboxEvents } from "@/modules/notifications/features/process-outbox-events/process-outbox-events";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { sweepStaleShiftAlertsSafe } from "../alerts-sweep";
import {
  parseAllowedEventTypes as parseProcessorEventTypes,
  parseIntEnv as parseProcessorInt,
  parseMinCreatedAt as parseProcessorMinCreatedAt,
} from "../processor-config";

function tokenMatches(expected: string, provided: string) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  return parseProcessorInt(raw, fallback);
}

function parseAllowedEventTypes(raw: string | undefined): string[] | undefined {
  return parseProcessorEventTypes(raw);
}

function parseMinCreatedAt(raw: string | undefined): string | undefined {
  return parseProcessorMinCreatedAt(raw);
}

function assertProcessorGuards(request: Request) {
  if (process.env.OUTBOX_PROCESSOR_ENABLED !== "true") {
    throw new Error("OUTBOX_PROCESSOR_DISABLED");
  }

  if (!hasDeliverableNotificationSenderFromEnv()) {
    throw new Error("OUTBOX_PROCESSOR_SENDER_NOT_CONFIGURED");
  }

  const expectedToken = process.env.OUTBOX_PROCESSOR_SECRET;
  const provided = request.headers.get("x-outbox-processor-secret");
  if (!expectedToken || !provided || !tokenMatches(expectedToken, provided)) {
    throw new Error("OUTBOX_PROCESSOR_AUTH_INVALID");
  }
}

function mapProcessorError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "OUTBOX_PROCESSOR_DISABLED") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Processor disabled" } },
        { status: 403 },
      );
    }
    if (error.message === "OUTBOX_PROCESSOR_AUTH_INVALID") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }
    if (error.message === "OUTBOX_PROCESSOR_SENDER_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          error: {
            code: "FAILED_PRECONDITION",
            message: "Notification sender not configured",
          },
        },
        { status: 412 },
      );
    }
    if (error.message === "OUTBOX_PROCESSOR_MIN_CREATED_AT_INVALID") {
      return NextResponse.json(
        {
          error: {
            code: "FAILED_PRECONDITION",
            message: "Invalid OUTBOX_PROCESSOR_MIN_CREATED_AT configuration",
          },
        },
        { status: 412 },
      );
    }
  }

  console.error(
    "[internal-endpoint] Unhandled error:",
    error instanceof Error ? error.message : String(error),
  );
  return NextResponse.json(
    { error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" } },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    assertProcessorGuards(request);

    registerOutboxEventBusHandlers();

    // Tarea 1.8 del brief: se registran los avisos de cajas abiertas >24 h antes de procesar la cola.
    // El barrido es best-effort: si falla, el procesamiento sigue.
    await sweepStaleShiftAlertsSafe();

    const repository = new PrismaOutboxRepository();
    const sender = createNotificationSenderFromEnv();

    const batchSize = parseIntEnv(process.env.OUTBOX_PROCESSOR_BATCH_SIZE, 10);
    const maxAttempts = parseIntEnv(process.env.OUTBOX_PROCESSOR_MAX_ATTEMPTS, 3);
    const allowedEventTypes = parseAllowedEventTypes(
      process.env.OUTBOX_PROCESSOR_ALLOWED_EVENT_TYPES,
    );
    const minCreatedAt = parseMinCreatedAt(
      process.env.OUTBOX_PROCESSOR_MIN_CREATED_AT,
    );

    const dedupTracker = new InMemoryDedupTracker();

    const result = await processOutboxEvents(
      { batchSize, maxAttempts, allowedEventTypes, minCreatedAt },
      { repository, sender, dedupTracker },
    );

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "OUTBOX_PROCESSOR_DISABLED" ||
        error.message === "OUTBOX_PROCESSOR_AUTH_INVALID" ||
        error.message === "OUTBOX_PROCESSOR_SENDER_NOT_CONFIGURED" ||
        error.message === "OUTBOX_PROCESSOR_MIN_CREATED_AT_INVALID")
    ) {
      return mapProcessorError(error);
    }
    return createErrorResponse(error);
  }
}
