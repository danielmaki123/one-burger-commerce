import { describe, expect, it, vi } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";


import { createOrder } from "./create-order";

function createRepository(): InMemoryOrderRepository {
  return new InMemoryOrderRepository();
}

function seedProduct(repository: InMemoryOrderRepository, overrides?: Partial<typeof repository.products[0]>) {
  const product = {
    id: "prod_01",
    name: "Cafe",
    basePrice: 100,
    packagingFeeAmount: null,
    isActive: true,
    isAvailable: true,
    modifierGroups: [],
    ...overrides,
  };
  repository.products.push(product);
  return product;
}

function seedTable(repository: InMemoryOrderRepository) {
  const table: typeof repository.tables[0] = {
    id: "table_04",
    label: "Mesa 4",
    qrToken: "qr_04",
    isActive: true,
    locationId: "main",
  };
  repository.tables.push(table);
  return table;
}

function seedDeliveryZone(repository: InMemoryOrderRepository, overrides?: Partial<typeof repository.zones[0]>) {
  const zone: typeof repository.zones[0] = {
    id: "zone_01",
    name: "Barrio Central",
    description: null,
    baseFee: 50,
    isActive: true,
    sortOrder: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  repository.zones.push(zone);
  return zone;
}

describe("createOrder", () => {
  it("creates a delivery order with totals calculated by backend", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository);

    const result = await createOrder(
      {
        type: "delivery",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
        address: "Barrio Central",
        deliveryNotes: "Portón negro",
        deliveryZoneId: "zone_01",
        customerLat: 12.1357,
        customerLng: -86.2514,
      },
      { repository },
    );

    expect(result.data.type).toBe("delivery");
    expect(result.data.status).toBe("new");
    expect(result.data.subtotal).toBe(200);
    expect(result.data.packagingAmount).toBe(0);
    expect(result.data.tipAmount).toBe(20);
    expect(result.data.tipRate).toBe(10);
    expect(result.data.total).toBe(270);
    expect(result.data.deliveryFeeAmount).toBe(50);
    expect(result.data.deliveryFeeStatus).toBe("pending_manual_validation");
    expect(result.meta.sourceOfTruth).toBe("backend");
  });

  it("calculates packaging and tip for delivery and snapshots packaging by line", async () => {
    const repository = createRepository();
    seedProduct(repository, { packagingFeeAmount: 10 });
    seedDeliveryZone(repository);

    const result = await createOrder(
      {
        type: "delivery",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
        address: "Barrio Central",
        deliveryNotes: "Portón negro",
        deliveryZoneId: "zone_01",
        tipOptIn: true,
      },
      { repository },
    );

    expect(result.data.subtotal).toBe(200);
    expect(result.data.packagingAmount).toBe(20);
    expect(result.data.tipAmount).toBe(20);
    expect(result.data.tipRate).toBe(10);
    expect(result.data.deliveryFeeAmount).toBe(50);
    expect(result.data.total).toBe(290);
    expect(result.data.items[0].packagingUnitAmount).toBe(10);
    expect(result.data.items[0].packagingQuantity).toBe(2);
    expect(result.data.items[0].packagingTotalAmount).toBe(20);
  });

  it("snapshots baseFee = 0 as authoritative delivery fee", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository, { baseFee: 0 });

    const result = await createOrder(
      {
        type: "delivery",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
        address: "Barrio Central",
        deliveryNotes: "Portón negro",
        deliveryZoneId: "zone_01",
        customerLat: 12.1357,
        customerLng: -86.2514,
      },
      { repository },
    );

    expect(result.data.type).toBe("delivery");
    expect(result.data.subtotal).toBe(200);
    expect(result.data.deliveryFeeAmount).toBe(0);
    expect(result.data.tipAmount).toBe(20);
    expect(result.data.total).toBe(220);
    expect(result.data.deliveryFeeStatus).toBe("pending_manual_validation");
  });

  it("generates orderLookupToken and returns it once on creation", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository },
    );

    expect(result.data.orderLookupToken).toBeDefined();
    expect(result.data.orderLookupToken).toHaveLength(48);
    expect(repository.orders[0].orderLookupTokenHash).toBeDefined();
    expect(repository.orders[0].orderLookupTokenHash).not.toBe(result.data.orderLookupToken);
  });

  it("uses injected token generator for deterministic tests", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository, orderLookupTokenGenerator: () => "abc123" },
    );

    expect(result.data.orderLookupToken).toBe("abc123");
  });

  it("persists geo fields for delivery orders", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository);

    const result = await createOrder(
      {
        type: "delivery",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        address: "Barrio Central",
        deliveryNotes: "Portón negro",
        deliveryZoneId: "zone_01",
        customerLat: 12.1357,
        customerLng: -86.2514,
        geoAccuracy: 12.5,
        geoCapturedAt: "2026-06-08T12:00:00.000Z",
      },
      { repository },
    );

    expect(result.data.deliveryZoneId).toBe("zone_01");
    expect(result.data.customerLat).toBe(12.1357);
    expect(result.data.customerLng).toBe(-86.2514);
    expect(result.data.geoAccuracy).toBe(12.5);
    expect(result.data.geoCapturedAt).toBe("2026-06-08T12:00:00.000Z");
    expect(result.data.deliveryFeeAmount).toBe(50);
    expect(result.data.tipAmount).toBe(10);
    expect(result.data.total).toBe(160);
  });

  it("sets deliveryFeeStatus to null for pickup orders", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository },
    );

    expect(result.data.deliveryFeeStatus).toBeNull();
    expect(result.data.deliveryFeeAmount).toBe(0);
  });

  it("allows removing the default tip for pickup orders", async () => {
    const repository = createRepository();
    seedProduct(repository, { packagingFeeAmount: 5 });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
        tipOptIn: false,
      },
      { repository },
    );

    expect(result.data.packagingAmount).toBe(10);
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.tipRate).toBeNull();
    expect(result.data.total).toBe(210);
  });

  it("sets deliveryFeeStatus to null for table orders", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedTable(repository);

    const result = await createOrder(
      {
        type: "table",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        tableId: "table_04",
      },
      { repository },
    );

    expect(result.data.deliveryFeeStatus).toBeNull();
    expect(result.data.deliveryFeeAmount).toBe(0);
    expect(result.data.packagingAmount).toBe(0);
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.tipRate).toBeNull();
  });

  it("rejects public creation with pre-confirmed delivery fee status", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository);

    await expect(
      createOrder(
        {
          type: "delivery",
          customerName: "Juan Perez",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          address: "Barrio Central",
          deliveryNotes: "Portón negro",
          deliveryZoneId: "zone_01",
          customerLat: 12.1357,
          customerLng: -86.2514,
          deliveryFeeStatus: "confirmed",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("sets customerId when auto-link resolver returns customer id", async () => {
    const repository = createRepository();
    seedProduct(repository);
    const resolveCustomerId = vi.fn().mockResolvedValue("customer_01");

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository, resolveCustomerId },
    );

    expect(resolveCustomerId).toHaveBeenCalledWith({
      fullName: "Juan Perez",
      whatsappNormalized: "+50588887777",
    });
    expect(result.data.customerId).toBe("customer_01");
  });

  it("continues order creation without customerId when auto-link fails", async () => {
    const repository = createRepository();
    seedProduct(repository);
    const resolveCustomerId = vi
      .fn()
      .mockRejectedValue(new Error("auto_link_failed"));

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository, resolveCustomerId },
    );

    expect(result.data.id).toBeTruthy();
    expect(result.data.customerId).toBeNull();
    expect(result.data.customerWhatsapp).toBe("+50588887777");
  });

  it("rejects delivery without address", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository);

    await expect(
      createOrder(
        {
          type: "delivery",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          deliveryZoneId: "zone_01",
          deliveryNotes: "Portón negro",
          customerLat: 12.1357,
          customerLng: -86.2514,
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("rejects delivery without zone", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(
        {
          type: "delivery",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          address: "Barrio Central",
          deliveryNotes: "Portón negro",
          customerLat: 12.1357,
          customerLng: -86.2514,
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("rejects delivery without notes", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository);

    await expect(
      createOrder(
        {
          type: "delivery",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          address: "Barrio Central",
          deliveryZoneId: "zone_01",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });

  it("allows delivery without geo coordinates when zone, address and notes exist", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository);

    const result = await createOrder(
      {
        type: "delivery",
        customerName: "Juan",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        address: "Barrio Central",
        deliveryNotes: "Portón negro",
        deliveryZoneId: "zone_01",
      },
      { repository },
    );

    expect(result.data.type).toBe("delivery");
    expect(result.data.customerLat).toBeNull();
    expect(result.data.customerLng).toBeNull();
    expect(result.data.deliveryFeeAmount).toBe(50);
    expect(result.data.tipAmount).toBe(10);
    expect(result.data.total).toBe(160);
  });

  it("rejects delivery with non-existent zone", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(
        {
          type: "delivery",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          address: "Barrio Central",
          deliveryNotes: "Portón negro",
          deliveryZoneId: "zone_does_not_exist",
          customerLat: 12.1357,
          customerLng: -86.2514,
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("rejects delivery with inactive zone", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedDeliveryZone(repository, { isActive: false });

    await expect(
      createOrder(
        {
          type: "delivery",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          address: "Barrio Central",
          deliveryNotes: "Portón negro",
          deliveryZoneId: "zone_01",
          customerLat: 12.1357,
          customerLng: -86.2514,
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects inactive product", async () => {
    const repository = createRepository();
    seedProduct(repository, { isActive: false });

    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("applies percentage coupon and calculates discount", async () => {
    const repository = createRepository();
    seedProduct(repository, { packagingFeeAmount: 10 });
    repository.coupons.push({
      id: "coupon_01",
      code: "BIENVENIDA10",
      type: "percentage",
      value: 10,
      isActive: true,
      usageLimit: 100,
      usedCount: 0,
      expiresAt: null,
    });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        couponCode: "BIENVENIDA10",
        tipOptIn: true,
      },
      { repository },
    );

    expect(result.data.subtotal).toBe(100);
    expect(result.data.discount).toBe(10);
    expect(result.data.packagingAmount).toBe(10);
    expect(result.data.tipAmount).toBe(9);
    expect(result.data.tipRate).toBe(10);
    expect(result.data.total).toBe(109);
  });

  it("validates table exists and is active", async () => {
    const repository = createRepository();
    seedProduct(repository);
    seedTable(repository);

    const result = await createOrder(
      {
        type: "table",
        customerName: "Juan",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        tableId: "table_04",
      },
      { repository },
    );

    expect(result.data.type).toBe("table");
    expect(result.data.tableId).toBe("table_04");
  });

  it("rejects table order with inactive table", async () => {
    const repository = createRepository();
    seedProduct(repository);
    const table = seedTable(repository);
    table.isActive = false;

    await expect(
      createOrder(
        {
          type: "table",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          tableId: "table_04",
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("validates required modifiers", async () => {
    const repository = createRepository();
    seedProduct(repository, {
      modifierGroups: [
        {
          id: "mg_01",
          name: "Size",
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
          options: [
            { id: "opt_01", name: "Grande", priceDelta: 20, isActive: true },
          ],
        },
      ],
    });

    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});
