import { describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { hashOrderLookupToken } from "@/modules/orders/domain/order-tracking";

import { getPublicOrder } from "./get-public-order";

describe("getPublicOrder", () => {
  it("returns public order detail when token is valid", async () => {
    const repository = new InMemoryOrderRepository();
    const token = "validtoken123";
    repository.orders.push({
      id: "ord_1",
      orderNumber: "D-ABC123",
      type: "delivery",
      status: "preparing",
      customerName: "Daniel",
      customerWhatsapp: "+50588887777",
      items: [
        {
          id: "item_1",
          productId: "prod_1",
          productName: "Yuca frita",
          quantity: 2,
          unitPrice: 120,
          packagingUnitAmount: 10,
          packagingQuantity: 2,
          packagingTotalAmount: 20,
          modifiers: [],
          notes: null,
          lineTotal: 240,
        },
      ],
      subtotal: 240,
      discount: 0,
      packagingAmount: 20,
      deliveryFeeAmount: 30,
      tipAmount: 24,
      tipRate: 10,
      total: 270,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      address: "Barrio Central, casa 12",
      deliveryNotes: "tocar porton",
      customerLat: 12.345,
      customerLng: -86.789,
      geoAccuracy: 10.5,
      geoCapturedAt: new Date().toISOString(),
      deliveryZoneId: "zone_1",
      deliveryZoneName: "Centro",
      orderLookupTokenHash: hashOrderLookupToken(token),
    });

    const result = await getPublicOrder("ord_1", token, { repository });

    expect(result.data.id).toBe("ord_1");
    expect(result.data.orderNumber).toBe("D-ABC123");
    expect(result.data.customerName).toBe("Daniel");
    expect(result.data.deliveryZoneName).toBe("Centro");
    expect(result.data.packagingAmount).toBe(20);
    expect(result.data.tipAmount).toBe(24);
    expect(result.data.tipRate).toBe(10);
    expect(result.data.items[0].packagingTotalAmount).toBe(20);
    expect(result.data.total).toBe(270);

    expect("customerWhatsapp" in result.data).toBe(false);
    expect("address" in result.data).toBe(false);
    expect("deliveryNotes" in result.data).toBe(false);
    expect("customerLat" in result.data).toBe(false);
    expect("customerLng" in result.data).toBe(false);
    expect("geoAccuracy" in result.data).toBe(false);
    expect("geoCapturedAt" in result.data).toBe(false);
    expect("orderLookupTokenHash" in result.data).toBe(false);
    expect("customerId" in result.data).toBe(false);
  });

  it("throws 401 when token is missing", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_1",
      orderNumber: "D-ABC123",
      type: "delivery",
      status: "preparing",
      customerName: "Daniel",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 0,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      orderLookupTokenHash: hashOrderLookupToken("sometoken"),
    });

    await expect(getPublicOrder("ord_1", null, { repository })).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("throws 404 when token is invalid", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_1",
      orderNumber: "D-ABC123",
      type: "delivery",
      status: "preparing",
      customerName: "Daniel",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 0,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      orderLookupTokenHash: hashOrderLookupToken("correcttoken"),
    });

    await expect(getPublicOrder("ord_1", "wrongtoken", { repository })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("throws 404 when order has no token hash stored", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_1",
      orderNumber: "D-ABC123",
      type: "delivery",
      status: "preparing",
      customerName: "Daniel",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 0,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      orderLookupTokenHash: null,
    });

    await expect(getPublicOrder("ord_1", "sometoken", { repository })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});
