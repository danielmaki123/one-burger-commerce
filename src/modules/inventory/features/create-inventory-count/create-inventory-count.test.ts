import { describe, expect, it } from "vitest";

import { subscribe } from "@/infrastructure/events/event-bus";
import { InMemoryInventoryRepository } from "@/modules/inventory/adapters/in-memory-inventory-repository";


import { createInventoryCount } from "./create-inventory-count";

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

describe("createInventoryCount", () => {
  it("creates a count and updates stock", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const result = await createInventoryCount(
      {
        inventoryItemId: item.id,
        countedQuantity: 8,
        countedByUserId: "user_01",
        notes: "cierre",
      },
      { repository },
    );

    expect(result.data.countedQuantity).toBe(8);
    expect(result.data.countedByUserId).toBe("user_01");

    const updated = await repository.findItemById(item.id);
    expect(updated?.currentEstimatedStock).toBe(8);
  });

  it("rejects negative countedQuantity", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    await expect(
      createInventoryCount(
        {
          inventoryItemId: item.id,
          countedQuantity: -1,
          countedByUserId: "user_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects missing inventoryItemId", async () => {
    const repository = createRepository();

    await expect(
      createInventoryCount(
        {
          inventoryItemId: "",
          countedQuantity: 5,
          countedByUserId: "user_01",
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
      createInventoryCount(
        {
          inventoryItemId: "missing",
          countedQuantity: 5,
          countedByUserId: "user_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("publishes InventoryLow event when count drops stock at or below threshold", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const events: Array<{ productId: string; productName: string }> = [];
    const unsubscribe = subscribe("InventoryLow", (payload: { productId: string; productName: string }) => {
      events.push(payload);
    });

    await createInventoryCount(
      {
        inventoryItemId: item.id,
        countedQuantity: 2,
        countedByUserId: "user_01",
      },
      { repository },
    );

    expect(events.length).toBe(1);
    expect(events[0].productId).toBe(item.id);
    expect(events[0].productName).toBe(item.name);

    unsubscribe();
  });

  it("does not publish InventoryLow when stock stays above threshold", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const events: Array<{ productId: string; productName: string }> = [];
    const unsubscribe = subscribe("InventoryLow", (payload: { productId: string; productName: string }) => {
      events.push(payload);
    });

    await createInventoryCount(
      {
        inventoryItemId: item.id,
        countedQuantity: 5,
        countedByUserId: "user_01",
      },
      { repository },
    );

    expect(events.length).toBe(0);

    unsubscribe();
  });

  it("is idempotent when idempotency key is reused", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const first = await createInventoryCount(
      {
        inventoryItemId: item.id,
        countedQuantity: 9,
        countedByUserId: "user_01",
      },
      { repository, idempotencyKey: "same-op" },
    );

    const second = await createInventoryCount(
      {
        inventoryItemId: item.id,
        countedQuantity: 9,
        countedByUserId: "user_01",
      },
      { repository, idempotencyKey: "same-op" },
    );

    expect(first.data.id).toBe(second.data.id);
    const updated = await repository.findItemById(item.id);
    expect(updated?.currentEstimatedStock).toBe(9);
  });
});
