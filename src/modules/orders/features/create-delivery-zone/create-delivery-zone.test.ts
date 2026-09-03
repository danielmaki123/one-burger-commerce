import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryDeliveryZoneRepository } from "@/modules/orders/adapters/in-memory-delivery-zone-repository";
import { createDeliveryZone } from "./create-delivery-zone";

describe("createDeliveryZone", () => {
  let repository: InMemoryDeliveryZoneRepository;

  beforeEach(() => {
    repository = new InMemoryDeliveryZoneRepository();
  });

  it("creates a delivery zone with default values", async () => {
    const result = await createDeliveryZone(
      { name: "Centro", baseFee: 5 },
      { repository },
    );
    expect(result.data.name).toBe("Centro");
    expect(result.data.baseFee).toBe(5);
    expect(result.data.isActive).toBe(true);
    expect(result.data.sortOrder).toBe(0);
    expect(result.data.description).toBeNull();
  });

  it("creates a delivery zone with all fields", async () => {
    const result = await createDeliveryZone(
      { name: "Norte", description: "Zona norte", baseFee: 10, isActive: false, sortOrder: 1 },
      { repository },
    );
    expect(result.data.name).toBe("Norte");
    expect(result.data.description).toBe("Zona norte");
    expect(result.data.baseFee).toBe(10);
    expect(result.data.isActive).toBe(false);
    expect(result.data.sortOrder).toBe(1);
  });

  it("rejects empty name", async () => {
    await expect(createDeliveryZone({ name: "", baseFee: 5 }, { repository })).rejects.toThrow("Invalid payload");
  });

  it("rejects negative baseFee", async () => {
    await expect(createDeliveryZone({ name: "Centro", baseFee: -1 }, { repository })).rejects.toThrow("baseFee must be >= 0");
  });

  it("rejects NaN baseFee", async () => {
    await expect(createDeliveryZone({ name: "Centro", baseFee: NaN }, { repository })).rejects.toThrow("Invalid payload");
  });

  it("rejects duplicate name case-insensitive", async () => {
    await createDeliveryZone({ name: "Centro", baseFee: 5 }, { repository });
    await expect(createDeliveryZone({ name: "centro", baseFee: 7 }, { repository })).rejects.toThrow("A delivery zone with this name already exists");
  });

  it("rejects duplicate name with different casing and whitespace", async () => {
    await createDeliveryZone({ name: "  Norte  ", baseFee: 5 }, { repository });
    await expect(createDeliveryZone({ name: "norte", baseFee: 7 }, { repository })).rejects.toThrow("A delivery zone with this name already exists");
  });
});
