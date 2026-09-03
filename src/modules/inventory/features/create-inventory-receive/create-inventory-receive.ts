import { InventoryError } from "@/modules/inventory/domain/inventory-errors";
import type { InventoryReceiveRecord } from "@/modules/inventory/domain/inventory.types";
import type {
  CreateInventoryReceiveInput,
  InventoryRepository,
} from "@/modules/inventory/ports/inventory-repository";
import {
  getIdempotentResult,
  setIdempotentResult,
} from "@/modules/inventory/features/shared/inventory-idempotency";

export async function createInventoryReceive(
  input: CreateInventoryReceiveInput,
  {
    repository,
    idempotencyKey,
  }: { repository: InventoryRepository; idempotencyKey?: string },
): Promise<{ data: InventoryReceiveRecord }> {
  if (!input.inventoryItemId || input.inventoryItemId.trim().length === 0) {
    throw new InventoryError(400, "BAD_REQUEST", "Invalid payload", {
      inventoryItemId: "Required",
    });
  }

  if (typeof input.receivedQuantity !== "number" || input.receivedQuantity < 0) {
    throw new InventoryError(422, "VALIDATION_ERROR", "receivedQuantity must be >= 0");
  }

  const item = await repository.findItemById(input.inventoryItemId);
  if (!item) {
    throw new InventoryError(404, "NOT_FOUND", "Inventory item not found");
  }

  const cacheKey = idempotencyKey ? `inventory:receive:${input.receivedByUserId}:${idempotencyKey}` : null;
  if (cacheKey) {
    const cached = getIdempotentResult<{ data: InventoryReceiveRecord }>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const receive = await repository.applyReceive({
    inventoryItemId: input.inventoryItemId,
    receivedQuantity: input.receivedQuantity,
    receivedByUserId: input.receivedByUserId,
    notes: input.notes ?? null,
  });
  const response = { data: receive };
  if (cacheKey) {
    setIdempotentResult(cacheKey, response);
  }
  return response;
}
