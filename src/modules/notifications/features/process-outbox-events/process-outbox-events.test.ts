import { describe, expect, it, vi } from "vitest";

import { InMemoryDedupTracker } from "@/modules/notifications/adapters/in-memory-dedup-tracker";
import { DummyNotificationSender } from "@/modules/notifications/adapters/dummy-notification-sender";
import { InMemoryOutboxRepository } from "@/modules/notifications/adapters/in-memory-outbox-repository";

import { processOutboxEvents } from "./process-outbox-events";

function createRepository(): InMemoryOutboxRepository {
  return new InMemoryOutboxRepository();
}

function createSender(): DummyNotificationSender {
  return new DummyNotificationSender();
}

describe("processOutboxEvents", () => {
  it("processes pending events and marks them as processed", async () => {
    const repository = createRepository();
    const sender = createSender();

    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
      payload: { order: { id: "ord_01" } },
    });

    const result = await processOutboxEvents(
      { batchSize: 10, maxAttempts: 3 },
      { repository, sender },
    );

    expect(result.data.processed).toBe(1);
    expect(result.data.failed).toBe(0);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].eventType).toBe("OrderCreated");

    const events = await repository.listEvents({});
    expect(events[0].status).toBe("processed");
    expect(events[0].processedAt).not.toBeNull();
  });

  it("increments attemptCount on sender failure", async () => {
    const repository = createRepository();
    const sender = createSender();
    sender.shouldFail = true;

    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });

    const result = await processOutboxEvents(
      { batchSize: 10, maxAttempts: 3 },
      { repository, sender },
    );

    expect(result.data.processed).toBe(0);
    expect(result.data.failed).toBe(1);

    const events = await repository.listEvents({});
    expect(events[0].status).toBe("pending");
    expect(events[0].attemptCount).toBe(1);
    expect(events[0].errorMessage).toBe("Dummy sender failure");
  });

  it("marks permanently failed after max attempts", async () => {
    const repository = createRepository();
    const sender = createSender();
    sender.shouldFail = true;

    const event = await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });
    event.attemptCount = 3;

    const result = await processOutboxEvents(
      { batchSize: 10, maxAttempts: 3 },
      { repository, sender },
    );

    expect(result.data.processed).toBe(0);
    expect(result.data.failed).toBe(1);

    const events = await repository.listEvents({});
    expect(events[0].status).toBe("failed");
    expect(events[0].errorMessage).toBe("Max attempts reached");
  });

  it("does not process already processed events", async () => {
    const repository = createRepository();
    const sender = createSender();

    const event = await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });
    await repository.markProcessed(event.id);

    const result = await processOutboxEvents(
      { batchSize: 10, maxAttempts: 3 },
      { repository, sender },
    );

    expect(result.data.processed).toBe(0);
    expect(result.data.failed).toBe(0);
    expect(sender.sent).toHaveLength(0);
  });

  it("respects batch size", async () => {
    const repository = createRepository();
    const sender = createSender();

    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });
    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_02",
    });

    const result = await processOutboxEvents(
      { batchSize: 1, maxAttempts: 3 },
      { repository, sender },
    );

    expect(result.data.processed).toBe(1);
    expect(result.data.failed).toBe(0);
    expect(sender.sent).toHaveLength(1);
  });

  it("deduplicates events within window when tracker provided", async () => {
    const repository = createRepository();
    const sender = createSender();
    const dedupTracker = new InMemoryDedupTracker();

    await repository.createEvent({
      eventType: "InventoryLow",
      aggregateType: "inventory",
      aggregateId: "inv_01",
      payload: { productName: "Rice" },
    });
    await repository.createEvent({
      eventType: "InventoryLow",
      aggregateType: "inventory",
      aggregateId: "inv_01",
      payload: { productName: "Rice" },
    });

    const result = await processOutboxEvents(
      { batchSize: 10, maxAttempts: 3 },
      { repository, sender, dedupTracker },
    );

    expect(result.data.processed).toBe(2);
    expect(result.data.failed).toBe(0);
    expect(sender.sent).toHaveLength(1);

    const events = await repository.listEvents({});
    expect(events.every((e) => e.status === "processed")).toBe(true);
  });

  it("sanitizes secrets from error messages", async () => {
    const repository = createRepository();
    const sender = createSender();
    sender.shouldFail = true;

    const secret = "my-super-secret-token";
    process.env.TELEGRAM_BOT_TOKEN = secret;

    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });

    sender.send = vi.fn().mockRejectedValue(new Error(`Failed with token ${secret}`));

    await processOutboxEvents(
      { batchSize: 10, maxAttempts: 3 },
      { repository, sender },
    );

    const events = await repository.listEvents({});
    expect(events[0].errorMessage).not.toContain(secret);
    expect(events[0].errorMessage).toContain("[REDACTED]");

    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  it("does not increment attemptCount when event is deduplicated", async () => {
    const repository = createRepository();
    const sender = createSender();
    const dedupTracker = new InMemoryDedupTracker();

    const event = await repository.createEvent({
      eventType: "InventoryLow",
      aggregateType: "inventory",
      aggregateId: "inv_01",
      payload: { productName: "Rice" },
    });
    event.attemptCount = 2;

    await processOutboxEvents(
      { batchSize: 10, maxAttempts: 3 },
      { repository, sender, dedupTracker },
    );

    const events = await repository.listEvents({});
    expect(events[0].status).toBe("processed");
    expect(events[0].attemptCount).toBe(2);
  });

  it("processes only allowed event types when allowlist is provided", async () => {
    const repository = createRepository();
    const sender = createSender();

    await repository.createEvent({
      eventType: "OrderStatusChanged",
      aggregateType: "order",
      aggregateId: "ord_01",
      payload: { orderId: "ord_01", status: "preparing" },
    });
    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_02",
      payload: { order: { id: "ord_02" } },
    });

    const result = await processOutboxEvents(
      {
        batchSize: 10,
        maxAttempts: 3,
        allowedEventTypes: ["OrderCreated", "ReservationCreated"],
      },
      { repository, sender },
    );

    expect(result.data.processed).toBe(1);
    expect(result.data.failed).toBe(0);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.eventType).toBe("OrderCreated");

    const events = await repository.listEvents({});
    const statusChanged = events.find((event) => event.eventType === "OrderStatusChanged");
    const orderCreated = events.find((event) => event.eventType === "OrderCreated");

    expect(statusChanged?.status).toBe("pending");
    expect(orderCreated?.status).toBe("processed");
  });

  it("respects a minimum createdAt cutoff when provided", async () => {
    const repository = createRepository();
    const sender = createSender();

    const oldEvent = await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_old",
      payload: { order: { id: "ord_old" } },
    });
    const newEvent = await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_new",
      payload: { order: { id: "ord_new" } },
    });

    oldEvent.createdAt = "2026-06-23T15:40:33.588Z";
    oldEvent.updatedAt = "2026-06-23T15:40:33.588Z";
    newEvent.createdAt = "2026-06-24T22:17:01.366Z";
    newEvent.updatedAt = "2026-06-24T22:17:01.366Z";

    const result = await processOutboxEvents(
      {
        batchSize: 10,
        maxAttempts: 3,
        allowedEventTypes: ["OrderCreated"],
        minCreatedAt: "2026-06-24T22:00:00.000Z",
      },
      { repository, sender },
    );

    expect(result.data.processed).toBe(1);
    expect(result.data.failed).toBe(0);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.aggregateId).toBe("ord_new");

    const events = await repository.listEvents({});
    expect(events.find((event) => event.aggregateId === "ord_old")?.status).toBe("pending");
    expect(events.find((event) => event.aggregateId === "ord_new")?.status).toBe("processed");
  });
});
