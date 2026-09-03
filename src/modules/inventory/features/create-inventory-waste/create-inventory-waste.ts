import { publish } from "@/infrastructure/events/event-bus";
import { InventoryError } from "@/modules/inventory/domain/inventory-errors";
import type { InventoryWasteRecord } from "@/modules/inventory/domain/inventory.types";
import type {
  CreateInventoryWasteInput,
  InventoryRepository,
} from "@/modules/inventory/ports/inventory-repository";
import {
  getIdempotentResult,
  setIdempotentResult,
} from "@/modules/inventory/features/shared/inventory-idempotency";

export async function createInventoryWaste(
  input: CreateInventoryWasteInput,
  {
    repository,
    idempotencyKey,
  }: { repository: InventoryRepository; idempotencyKey?: string },
): Promise<{ data: InventoryWasteRecord }> {
  if (!input.inventoryItemId || input.inventoryItemId.trim().length === 0) {
    throw new InventoryError(400, "BAD_REQUEST", "Invalid payload", {
      inventoryItemId: "Required",
    });
  }

  if (typeof input.quantity !== "number" || input.quantity < 0) {
    throw new InventoryError(422, "VALIDATION_ERROR", "quantity must be >= 0");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new InventoryError(400, "BAD_REQUEST", "Invalid payload", {
      reason: "Required",
    });
  }

  const item = await repository.findItemById(input.inventoryItemId);
  if (!item) {
    throw new InventoryError(404, "NOT_FOUND", "Inventory item not found");
  }

  const cacheKey = idempotencyKey ? `inventory:waste:${input.reportedByUserId}:${idempotencyKey}` : null;
  if (cacheKey) {
    const cached = getIdempotentResult<{ data: InventoryWasteRecord }>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const waste = await repository.applyWaste({
    inventoryItemId: input.inventoryItemId,
    quantity: input.quantity,
    reason: input.reason.trim(),
    reportedByUserId: input.reportedByUserId,
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

  const response = { data: waste };
  if (cacheKey) {
    setIdempotentResult(cacheKey, response);
  }
  return response;
}
