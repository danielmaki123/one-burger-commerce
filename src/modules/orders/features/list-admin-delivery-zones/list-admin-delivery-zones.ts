import type { DeliveryZoneRepository } from "@/modules/orders/ports/delivery-zone-repository";

type ListAdminDeliveryZonesDependencies = {
  repository: DeliveryZoneRepository;
};

export async function listAdminDeliveryZones({
  repository,
}: ListAdminDeliveryZonesDependencies) {
  const zones = await repository.listDeliveryZones();
  return { data: zones };
}
