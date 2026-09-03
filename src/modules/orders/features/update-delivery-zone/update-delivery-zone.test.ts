import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryDeliveryZoneRepository } from "@/modules/orders/adapters/in-memory-delivery-zone-repository";
import { updateDeliveryZone } from "./update-delivery-zone";

describe("updateDeliveryZone", () => {
  let repository: InMemoryDeliveryZoneRepository;

  beforeEach(async () => {
    repository = new InMemoryDeliveryZoneRepository();
    await repository.createDeliveryZone({ name: "Centro", baseFee: 5 });
    await repository.createDeliveryZone({ name: "Norte", baseFee: 10 });
  });

  it("updates name and baseFee", async () => {
    const result = await updateDeliveryZone("dz_1", { name: "Centro Actualizado", baseFee: 7 }, { repository });
    expect(result.data.name).toBe("Centro Actualizado");
    expect(result.data.baseFee).toBe(7);
    expect(result.data.isActive).toBe(true);
  });

  it("deactivates a zone", async () => {
    const result = await updateDeliveryZone("dz_1", { isActive: false }, { repository });
    expect(result.data.isActive).toBe(false);
  });

  it("rejects empty name", async () => {
    await expect(updateDeliveryZone("dz_1", { name: "" }, { repository })).rejects.toThrow("Invalid payload");
  });

  it("rejects negative baseFee", async () => {
    await expect(updateDeliveryZone("dz_1", { baseFee: -1 }, { repository })).rejects.toThrow("baseFee must be >= 0");
  });

  it("throws 404 for missing zone", async () => {
    await expect(updateDeliveryZone("dz_missing", { name: "X" }, { repository })).rejects.toThrow("Delivery zone not found");
  });

  it("rejects rename to an existing name with different casing", async () => {
    await expect(updateDeliveryZone("dz_1", { name: "norte" }, { repository })).rejects.toThrow("A delivery zone with this name already exists");
  });

  it("allows keeping the same name on update", async () => {
    const result = await updateDeliveryZone("dz_1", { name: "centro", baseFee: 6 }, { repository });
    expect(result.data.name).toBe("centro");
    expect(result.data.baseFee).toBe(6);
  });

  it("rejects rename to an existing name with extra whitespace and different casing", async () => {
    await expect(updateDeliveryZone("dz_1", { name: "  NORTE  " }, { repository })).rejects.toThrow("A delivery zone with this name already exists");
  });
});
