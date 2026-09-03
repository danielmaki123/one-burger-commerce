import type { InventoryAlert } from "@/modules/inventory/domain/inventory.types";
import type { InventoryRepository } from "@/modules/inventory/ports/inventory-repository";

export async function listInventoryAlerts({
  repository,
}: {
  repository: InventoryRepository;
}): Promise<{ data: InventoryAlert[]; meta: { total: number } }> {
  const alerts = await repository.listAlerts();
  return {
    data: alerts,
    meta: { total: alerts.length },
  };
}
