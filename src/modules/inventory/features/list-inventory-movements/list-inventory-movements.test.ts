import { describe, expect, it } from "vitest";

import { InMemoryInventoryRepository } from "@/modules/inventory/adapters/in-memory-inventory-repository";

import { listInventoryMovements } from "./list-inventory-movements";

describe("listInventoryMovements", () => {
  it("returns mixed movement history with data/meta", async () => {
    const repository = new InMemoryInventoryRepository();
    const item = await repository.createItem({
      name: "Azucar",
      unit: "kg",
      category: "insumos",
      currentEstimatedStock: 5,
      lowStockThreshold: 2,
      isActive: true,
    });

    await repository.applyReceive({
      inventoryItemId: item.id,
      receivedQuantity: 2,
      receivedByUserId: "admin_1",
    });

    await repository.applyWaste({
      inventoryItemId: item.id,
      quantity: 1,
      reason: "test",
      reportedByUserId: "admin_1",
    });

    const result = await listInventoryMovements({ inventoryItemId: item.id }, { repository });

    expect(result.data.length).toBe(2);
    expect(result.meta.total).toBe(2);
    expect(result.meta.limit).toBe(50);
  });
});
