import { describe, expect, it } from "vitest";

import { InMemoryOutboxRepository } from "@/modules/notifications/adapters/in-memory-outbox-repository";

import { registerOutboxEvent } from "./register-outbox-event";

function createRepository(): InMemoryOutboxRepository {
  return new InMemoryOutboxRepository();
}

describe("registerOutboxEvent", () => {
  it("creates a pending outbox event", async () => {
    const repository = createRepository();
    const result = await registerOutboxEvent(
      {
        eventType: "OrderCreated",
        aggregateType: "order",
        aggregateId: "ord_01",
        payload: { order: { id: "ord_01" } },
      },
      { repository },
    );

    expect(result.data.eventType).toBe("OrderCreated");
    expect(result.data.aggregateType).toBe("order");
    expect(result.data.aggregateId).toBe("ord_01");
    expect(result.data.status).toBe("pending");
    expect(result.data.attemptCount).toBe(0);
  });

  it("defaults payload to empty object", async () => {
    const repository = createRepository();
    const result = await registerOutboxEvent(
      {
        eventType: "InventoryLow",
        aggregateType: "inventory",
        aggregateId: "prod_01",
      },
      { repository },
    );

    expect(result.data.payload).toEqual({});
  });
});
