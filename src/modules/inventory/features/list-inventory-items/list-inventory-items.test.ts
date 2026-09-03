import { describe, expect, it } from "vitest";

import { InMemoryInventoryRepository } from "@/modules/inventory/adapters/in-memory-inventory-repository";

import { listInventoryItems } from "./list-inventory-items";

describe("listInventoryItems", () => {
  it("returns data/meta payload", async () => {
    const repository = new InMemoryInventoryRepository();
    await repository.createItem({
      name: "Harina",
      unit: "kg",
      category: "insumos",
      currentEstimatedStock: 4,
      lowStockThreshold: 1,
      isActive: true,
    });

    const result = await listInventoryItems({}, { repository });

    expect(result.data.length).toBe(1);
    expect(result.meta.total).toBe(1);
  });
});
