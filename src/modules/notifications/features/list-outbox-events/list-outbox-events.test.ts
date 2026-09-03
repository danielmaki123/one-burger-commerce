import { describe, expect, it } from "vitest";

import { InMemoryOutboxRepository } from "@/modules/notifications/adapters/in-memory-outbox-repository";

import { listOutboxEvents } from "./list-outbox-events";

function createRepository(): InMemoryOutboxRepository {
  return new InMemoryOutboxRepository();
}

describe("listOutboxEvents", () => {
  it("returns all events when no filter is applied", async () => {
    const repository = createRepository();
    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });
    await repository.createEvent({
      eventType: "ReservationCreated",
      aggregateType: "reservation",
      aggregateId: "res_01",
    });

    const result = await listOutboxEvents({}, { repository });
    expect(result.data).toHaveLength(2);
  });

  it("filters by status", async () => {
    const repository = createRepository();
    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });
    const event2 = await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_02",
    });
    await repository.markProcessed(event2.id);

    const result = await listOutboxEvents({ status: "pending" }, { repository });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].status).toBe("pending");
  });

  it("filters by eventType", async () => {
    const repository = createRepository();
    await repository.createEvent({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
    });
    await repository.createEvent({
      eventType: "ReservationCreated",
      aggregateType: "reservation",
      aggregateId: "res_01",
    });

    const result = await listOutboxEvents({ eventType: "OrderCreated" }, { repository });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].eventType).toBe("OrderCreated");
  });
});
