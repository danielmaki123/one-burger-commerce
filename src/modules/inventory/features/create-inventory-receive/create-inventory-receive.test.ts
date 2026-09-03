import { describe, expect, it } from "vitest";

import { InMemoryInventoryRepository } from "@/modules/inventory/adapters/in-memory-inventory-repository";


import { createInventoryReceive } from "./create-inventory-receive";

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

describe("createInventoryReceive", () => {
  it("creates a receive record and increases stock", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const result = await createInventoryReceive(
      {
        inventoryItemId: item.id,
        receivedQuantity: 5,
        receivedByUserId: "user_01",
        notes: "proveedor A",
      },
      { repository },
    );

    expect(result.data.receivedQuantity).toBe(5);

    const updated = await repository.findItemById(item.id);
    expect(updated?.currentEstimatedStock).toBe(15);
  });

  it("rejects negative receivedQuantity", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    await expect(
      createInventoryReceive(
        {
          inventoryItemId: item.id,
          receivedQuantity: -1,
          receivedByUserId: "user_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects nonexistent item", async () => {
    const repository = createRepository();

    await expect(
      createInventoryReceive(
        {
          inventoryItemId: "missing",
          receivedQuantity: 5,
          receivedByUserId: "user_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("is idempotent when idempotency key is reused", async () => {
    const repository = createRepository();
    const item = await seedItem(repository, 10, 2);

    const first = await createInventoryReceive(
      {
        inventoryItemId: item.id,
        receivedQuantity: 2,
        receivedByUserId: "user_01",
      },
      { repository, idempotencyKey: "same-op" },
    );

    const second = await createInventoryReceive(
      {
        inventoryItemId: item.id,
        receivedQuantity: 2,
        receivedByUserId: "user_01",
      },
      { repository, idempotencyKey: "same-op" },
    );

    expect(first.data.id).toBe(second.data.id);
    const updated = await repository.findItemById(item.id);
    expect(updated?.currentEstimatedStock).toBe(12);
  });
});
