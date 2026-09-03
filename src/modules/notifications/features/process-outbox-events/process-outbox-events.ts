import type { OutboxDedupTracker } from "@/modules/notifications/ports/outbox-dedup";
import type { OutboxRepository } from "@/modules/notifications/ports/outbox-repository";
import type { NotificationSender } from "@/modules/notifications/ports/notification-sender";

function sanitizeGlobalSecrets(message: string): string {
  const secrets = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.N8N_WEBHOOK_SECRET,
    process.env.OUTBOX_PROCESSOR_SECRET,
  ].filter((s): s is string => Boolean(s));

  let result = message;
  for (const secret of secrets) {
    result = result.replaceAll(secret, "[REDACTED]");
  }
  return result;
}

function buildDedupKey(event: {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}): string {
  const payloadHash =
    typeof event.payload === "object" && event.payload !== null
      ? JSON.stringify(event.payload)
      : String(event.payload);
  return `${event.eventType}:${event.aggregateType}:${event.aggregateId}:${payloadHash}`;
}

export async function processOutboxEvents(
  {
    batchSize = 10,
    maxAttempts = 3,
    allowedEventTypes,
    minCreatedAt,
  }: {
    batchSize?: number;
    maxAttempts?: number;
    allowedEventTypes?: string[];
    minCreatedAt?: string;
  },
  {
    repository,
    sender,
    dedupTracker,
  }: {
    repository: OutboxRepository;
    sender: NotificationSender;
    dedupTracker?: OutboxDedupTracker;
  },
) {
  const events = await repository.lockPendingEvents(batchSize, {
    eventTypes: allowedEventTypes,
    minCreatedAt,
  });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    if (event.attemptCount >= maxAttempts) {
      await repository.markPermanentlyFailed(
        event.id,
        sanitizeGlobalSecrets("Max attempts reached"),
      );
      failed++;
      continue;
    }

    const dedupKey = buildDedupKey(event);
    if (dedupTracker && dedupTracker.isDuplicate(dedupKey)) {
      await repository.markProcessed(event.id);
      processed++;
      continue;
    }

    try {
      await sender.send({
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
      });
      await repository.markProcessed(event.id);
      if (dedupTracker) {
        dedupTracker.track(dedupKey);
      }
      processed++;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const message = sanitizeGlobalSecrets(raw);
      await repository.incrementAttempt(event.id, message);
      failed++;
    }
  }

  return {
    data: { processed, failed },
  };
}
