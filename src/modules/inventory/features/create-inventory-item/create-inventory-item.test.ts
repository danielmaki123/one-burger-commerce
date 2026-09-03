import { describe, expect, it } from "vitest";

import { InMemoryInventoryRepository } from "@/modules/inventory/adapters/in-memory-inventory-repository";
import { InventoryError } from "@/modules/inventory/domain/inventory-errors";

import { createInventoryItem } from "./create-inventory-item";

function createRepository(): InMemoryInventoryRepository {
  return new InMemoryInventoryRepository();
}

describe("createInventoryItem", () => {
  it("creates an item with valid input", async () => {
    const repository = createRepository();
    const result = await createInventoryItem(
      {
        name: "Cafe molido",
        unit: "kg",
        category: "insumos",
        currentEstimatedStock: 10,
        lowStockThreshold: 2,
        isActive: true,
      },
      { repository },
    );

    expect(result.data.name).toBe("Cafe molido");
    expect(result.data.unit).toBe("kg");
    expect(result.data.category).toBe("insumos");
    expect(result.data.currentEstimatedStock).toBe(10);
    expect(result.data.lowStockThreshold).toBe(2);
    expect(result.data.isActive).toBe(true);
  });

  it("rejects missing name", async () => {
    const repository = createRepository();
    await expect(
      createInventoryItem(
        {
          name: "",
          unit: "kg",
          category: "insumos",
          currentEstimatedStock: 10,
          lowStockThreshold: 2,
          isActive: true,
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(InventoryError);
  });

  it("rejects missing unit", async () => {
    const repository = createRepository();
    await expect(
      createInventoryItem(
        {
          name: "Cafe molido",
          unit: "",
          category: "insumos",
          currentEstimatedStock: 10,
          lowStockThreshold: 2,
          isActive: true,
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(InventoryError);
  });

  it("rejects negative currentEstimatedStock", async () => {
    const repository = createRepository();
    await expect(
      createInventoryItem(
        {
          name: "Cafe molido",
          unit: "kg",
          category: "insumos",
          currentEstimatedStock: -1,
          lowStockThreshold: 2,
          isActive: true,
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects negative lowStockThreshold", async () => {
    const repository = createRepository();
    await expect(
      createInventoryItem(
        {
          name: "Cafe molido",
          unit: "kg",
          category: "insumos",
          currentEstimatedStock: 10,
          lowStockThreshold: -1,
          isActive: true,
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});
