import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryDeliveryZoneRepository } from "@/modules/orders/adapters/in-memory-delivery-zone-repository";
import { getAdminDeliveryZone } from "./get-admin-delivery-zone";

describe("getAdminDeliveryZone", () => {
  let repository: InMemoryDeliveryZoneRepository;

  beforeEach(async () => {
    repository = new InMemoryDeliveryZoneRepository();
    await repository.createDeliveryZone({ name: "Centro", baseFee: 5 });
  });

  it("returns the zone by id", async () => {
    const result = await getAdminDeliveryZone("dz_1", { repository });
    expect(result.data.name).toBe("Centro");
  });

  it("throws 404 for missing zone", async () => {
    await expect(getAdminDeliveryZone("dz_missing", { repository })).rejects.toThrow("Delivery zone not found");
  });
});
