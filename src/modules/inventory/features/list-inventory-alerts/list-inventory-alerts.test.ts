import { describe, expect, it } from "vitest";

import { InMemoryInventoryRepository } from "@/modules/inventory/adapters/in-memory-inventory-repository";

import { listInventoryAlerts } from "./list-inventory-alerts";

function createRepository(): InMemoryInventoryRepository {
  return new InMemoryInventoryRepository();
}

describe("listInventoryAlerts", () => {
  it("returns alerts for items at or below threshold", async () => {
    const repository = createRepository();

    await repository.createItem({
      name: "Cafe molido",
      unit: "kg",
      category: "insumos",
      currentEstimatedStock: 1,
      lowStockThreshold: 2,
      isActive: true,
    });

    await repository.createItem({
      name: "Azucar",
      unit: "kg",
      category: "insumos",
      currentEstimatedStock: 5,
      lowStockThreshold: 2,
      isActive: true,
    });

    const result = await listInventoryAlerts({ repository });

    expect(result.data.length).toBe(1);
    expect(result.meta.total).toBe(1);
    expect(result.data[0].currentEstimatedStock).toBe(1);
    expect(result.data[0].lowStockThreshold).toBe(2);
    expect(result.data[0].severity).toBe("warning");
  });

  it("returns critical severity when stock is zero", async () => {
    const repository = createRepository();

    await repository.createItem({
      name: "Cafe molido",
      unit: "kg",
      category: "insumos",
      currentEstimatedStock: 0,
      lowStockThreshold: 2,
      isActive: true,
    });

    const result = await listInventoryAlerts({ repository });

    expect(result.data.length).toBe(1);
    expect(result.meta.total).toBe(1);
    expect(result.data[0].severity).toBe("critical");
  });

  it("does not include inactive items", async () => {
    const repository = createRepository();

    await repository.createItem({
      name: "Cafe molido",
      unit: "kg",
      category: "insumos",
      currentEstimatedStock: 0,
      lowStockThreshold: 2,
      isActive: false,
    });

    const result = await listInventoryAlerts({ repository });

    expect(result.data.length).toBe(0);
    expect(result.meta.total).toBe(0);
  });
});
