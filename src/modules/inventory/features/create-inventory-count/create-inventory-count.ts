import { publish } from "@/infrastructure/events/event-bus";
import { InventoryError } from "@/modules/inventory/domain/inventory-errors";
import type { InventoryCountRecord } from "@/modules/inventory/domain/inventory.types";
import type {
  CreateInventoryCountInput,
  InventoryRepository,
} from "@/modules/inventory/ports/inventory-repository";
import {
  getIdempotentResult,
  setIdempotentResult,
} from "@/modules/inventory/features/shared/inventory-idempotency";

export async function createInventoryCount(
  input: CreateInventoryCountInput,
  {
    repository,
    idempotencyKey,
  }: { repository: InventoryRepository; idempotencyKey?: string },
): Promise<{ data: InventoryCountRecord }> {
  if (!input.inventoryItemId || input.inventoryItemId.trim().length === 0) {
    throw new InventoryError(400, "BAD_REQUEST", "Invalid payload", {
      inventoryItemId: "Required",
    });
  }

  if (typeof input.countedQuantity !== "number" || input.countedQuantity < 0) {
    throw new InventoryError(422, "VALIDATION_ERROR", "countedQuantity must be >= 0");
  }

  const item = await repository.findItemById(input.inventoryItemId);
  if (!item) {
    throw new InventoryError(404, "NOT_FOUND", "Inventory item not found");
  }

  const cacheKey = idempotencyKey ? `inventory:count:${input.countedByUserId}:${idempotencyKey}` : null;
  if (cacheKey) {
    const cached = getIdempotentResult<{ data: InventoryCountRecord }>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const count = await repository.applyCount({
    inventoryItemId: input.inventoryItemId,
    countedQuantity: input.countedQuantity,
    countedByUserId: input.countedByUserId,
    notes: input.notes ?? null,
  });
  const updatedItem = await repository.findItemById(input.inventoryItemId);
  if (!updatedItem) {
    throw new InventoryError(404, "NOT_FOUND", "Inventory item not found");
  }

  if (updatedItem.currentEstimatedStock <= updatedItem.lowStockThreshold) {
    await publish("InventoryLow", {
      productId: updatedItem.id,
      productName: updatedItem.name,
    });
  }

  const response = { data: count };
  if (cacheKey) {
    setIdempotentResult(cacheKey, response);
  }
  return response;
}
