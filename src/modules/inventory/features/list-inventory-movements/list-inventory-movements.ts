import type { InventoryMovementType } from "@/modules/inventory/domain/inventory.types";
import type { InventoryRepository } from "@/modules/inventory/ports/inventory-repository";

export async function listInventoryMovements(
  filter: {
    inventoryItemId?: string;
    type?: InventoryMovementType;
    limit?: number;
  },
  { repository }: { repository: InventoryRepository },
): Promise<{
  data: Awaited<ReturnType<InventoryRepository["listMovements"]>>;
  meta: { total: number; limit: number };
}> {
  const limit = typeof filter.limit === "number" ? Math.min(Math.max(filter.limit, 1), 200) : 50;
  const movements = await repository.listMovements({ ...filter, limit });
  return {
    data: movements,
    meta: {
      total: movements.length,
      limit,
    },
  };
}
