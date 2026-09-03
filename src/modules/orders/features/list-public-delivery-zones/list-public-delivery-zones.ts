import type { DeliveryZoneRepository } from "@/modules/orders/ports/delivery-zone-repository";

type ListPublicDeliveryZonesDependencies = {
  repository: DeliveryZoneRepository;
};

export async function listPublicDeliveryZones({
  repository,
}: ListPublicDeliveryZonesDependencies) {
  const zones = await repository.listDeliveryZones();
  return { data: zones.filter((z) => z.isActive) };
}
