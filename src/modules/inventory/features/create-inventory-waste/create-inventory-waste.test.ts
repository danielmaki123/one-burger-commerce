import { describe, expect, it } from "vitest";

import { subscribe } from "@/infrastructure/events/event-bus";
import { InMemoryInventoryRepository } from "@/modules/inventory/adapters/in-memory-inventory-repository";


import { createInventoryWaste } from "./create-inventory-waste";

function createRepository(): InMemoryInventoryRepository {
  return new InMemoryInventoryRepository();
}

async function seedItem(repository: InMemoryInventoryRepository, stock: number, threshold: number) {
  const item = await repository.createItem({
    name: "Cafe molido",
    unit: "kg",
    category: "insumos",
    currentEstimatedStock: stock,
    lowStockThreshold: threshold,
    isActive: true,
  });
  return item;
}

describe("createInventoryWaste", () => {
  it("creates a waste record and reduces stock", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const result = await createInventoryWaste(
      {
        inventoryItemId: item.id,
        quantity: 3,
        reason: "derrame",
        reportedByUserId: "user_01",
        notes: "caida",
      },
      { repository },
    );

    expect(result.data.quantity).toBe(3);
    expect(result.data.reason).toBe("derrame");

    const updated = await repository.findItemById(item.id);
    expect(updated?.currentEstimatedStock).toBe(7);
  });

  it("does not let stock go below zero", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 2, 2);

    const result = await createInventoryWaste(
      {
        inventoryItemId: item.id,
        quantity: 5,
        reason: "derrame",
        reportedByUserId: "user_01",
      },
      { repository },
    );

    expect(result.data.quantity).toBe(5);

    const updated = await repository.findItemById(item.id);
    expect(updated?.currentEstimatedStock).toBe(0);
  });

  it("rejects negative quantity", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    await expect(
      createInventoryWaste(
        {
          inventoryItemId: item.id,
          quantity: -1,
          reason: "derrame",
          reportedByUserId: "user_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects missing reason", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    await expect(
      createInventoryWaste(
        {
          inventoryItemId: item.id,
          quantity: 1,
          reason: "",
          reportedByUserId: "user_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("rejects nonexistent item", async () => {
    const repository = createRepository();

    await expect(
      createInventoryWaste(
        {
          inventoryItemId: "missing",
          quantity: 1,
          reason: "derrame",
          reportedByUserId: "user_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("publishes InventoryLow when waste drops stock at or below threshold", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 5, 2);

    const events: Array<{ productId: string; productName: string }> = [];
    const unsubscribe = subscribe("InventoryLow", (payload: { productId: string; productName: string }) => {
      events.push(payload);
    });

    await createInventoryWaste(
      {
        inventoryItemId: item.id,
        quantity: 3,
        reason: "derrame",
        reportedByUserId: "user_01",
      },
      { repository },
    );

    expect(events.length).toBe(1);
    expect(events[0].productId).toBe(item.id);

    unsubscribe();
  });

  it("is idempotent when idempotency key is reused", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const first = await createInventoryWaste(
      {
        inventoryItemId: item.id,
        quantity: 2,
        reason: "test",
        reportedByUserId: "user_01",
      },
      { repository, idempotencyKey: "same-op" },
    );

    const second = await createInventoryWaste(
      {
        inventoryItemId: item.id,
        quantity: 2,
        reason: "test",
        reportedByUserId: "user_01",
      },
      { repository, idempotencyKey: "same-op" },
    );

    expect(first.data.id).toBe(second.data.id);
    const updated = await repository.findItemById(item.id);
    expect(updated?.currentEstimatedStock).toBe(8);
  });
});
