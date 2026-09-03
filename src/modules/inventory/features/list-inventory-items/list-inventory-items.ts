import type { InventoryItemRecord } from "@/modules/inventory/domain/inventory.types";
import type {
  InventoryRepository,
  ListInventoryItemsFilter,
} from "@/modules/inventory/ports/inventory-repository";

export async function listInventoryItems(
  filter: ListInventoryItemsFilter,
  { repository }: { repository: InventoryRepository },
): Promise<{ data: InventoryItemRecord[]; meta: { total: number } }> {
  const items = await repository.listItems(filter);
  return {
    data: items,
    meta: { total: items.length },
  };
}
