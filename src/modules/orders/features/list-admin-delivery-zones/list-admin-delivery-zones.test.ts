import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryDeliveryZoneRepository } from "@/modules/orders/adapters/in-memory-delivery-zone-repository";
import { listAdminDeliveryZones } from "./list-admin-delivery-zones";

describe("listAdminDeliveryZones", () => {
  let repository: InMemoryDeliveryZoneRepository;

  beforeEach(async () => {
    repository = new InMemoryDeliveryZoneRepository();
    await repository.createDeliveryZone({ name: "Centro", baseFee: 5, sortOrder: 1 });
    await repository.createDeliveryZone({ name: "Norte", baseFee: 10, sortOrder: 0 });
  });

  it("returns all zones sorted by sortOrder", async () => {
    const result = await listAdminDeliveryZones({ repository });
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe("Norte");
    expect(result.data[1].name).toBe("Centro");
  });
});
