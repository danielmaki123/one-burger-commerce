import { OrderError } from "@/modules/orders/domain/order-errors";
import type { DeliveryZoneRecord } from "@/modules/orders/domain/order.types";
import type { DeliveryZoneRepository } from "@/modules/orders/ports/delivery-zone-repository";

type GetAdminDeliveryZoneDependencies = {
  repository: DeliveryZoneRepository;
};

export async function getAdminDeliveryZone(
  id: string,
  { repository }: GetAdminDeliveryZoneDependencies,
): Promise<{ data: DeliveryZoneRecord }> {
  const zone = await repository.getDeliveryZoneById(id);
  if (!zone) {
    throw new OrderError(404, "NOT_FOUND", "Delivery zone not found");
  }
  return { data: zone };
}
