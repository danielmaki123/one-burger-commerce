import { InventoryError } from "@/modules/inventory/domain/inventory-errors";
import type { InventoryItemRecord } from "@/modules/inventory/domain/inventory.types";
import type {
  CreateInventoryItemInput,
  InventoryRepository,
} from "@/modules/inventory/ports/inventory-repository";

export async function createInventoryItem(
  input: CreateInventoryItemInput,
  { repository }: { repository: InventoryRepository },
): Promise<{ data: InventoryItemRecord }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new InventoryError(400, "BAD_REQUEST", "Invalid payload", {
      name: "Required",
    });
  }

  if (!input.unit || input.unit.trim().length === 0) {
    throw new InventoryError(400, "BAD_REQUEST", "Invalid payload", {
      unit: "Required",
    });
  }

  if (!input.category || input.category.trim().length === 0) {
    throw new InventoryError(400, "BAD_REQUEST", "Invalid payload", {
      category: "Required",
    });
  }

  if (typeof input.currentEstimatedStock !== "number" || input.currentEstimatedStock < 0) {
    throw new InventoryError(422, "VALIDATION_ERROR", "currentEstimatedStock must be >= 0");
  }

  if (typeof input.lowStockThreshold !== "number" || input.lowStockThreshold < 0) {
    throw new InventoryError(422, "VALIDATION_ERROR", "lowStockThreshold must be >= 0");
  }

  const item = await repository.createItem({
    name: input.name.trim(),
    unit: input.unit.trim(),
    category: input.category.trim(),
    currentEstimatedStock: input.currentEstimatedStock,
    lowStockThreshold: input.lowStockThreshold,
    isActive: input.isActive ?? true,
  });

  return { data: item };
}
