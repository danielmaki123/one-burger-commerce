import { describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { hashOrderLookupToken } from "@/modules/orders/domain/order-tracking";

import { trackOrder } from "./track-order";

describe("trackOrder", () => {
  it("returns public-safe tracking payload for matching orderNumber + whatsapp", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_1",
      orderNumber: "D-ABC123",
      locationId: "loc_principal",
      type: "delivery",
      status: "preparing",
      customerName: "Daniel",
      customerWhatsapp: "+505 8888-7777",
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
      deliveryFeeAmount: 0,
      tipAmount: 24,
      tipRate: 10,
      total: 240,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      address: "direccion oculta",
    });

    const result = await trackOrder(
      { orderNumber: "D-ABC123", customerWhatsapp: "+50588887777" },
      { repository },
    );

    expect(result.data).toEqual({
      orderNumber: "D-ABC123",
      type: "delivery",
      status: "preparing",
      statusLabel: "En preparación",
      updatedAt: result.data.updatedAt,
      items: [{ productName: "Yuca frita", quantity: 2 }],
      subtotal: 240,
      discount: 0,
      packagingAmount: 20,
      deliveryFeeAmount: 0,
      tipAmount: 24,
      tipRate: 10,
      total: 240,
    });
    expect("id" in result.data).toBe(false);
    expect("address" in result.data).toBe(false);
  });

  it("rejects when whatsapp does not match", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_1",
      orderNumber: "D-ABC123",
      locationId: "loc_principal",
      type: "delivery",
      status: "new",
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
    });

    await expect(
      trackOrder(
        { orderNumber: "D-ABC123", customerWhatsapp: "+50599990000" },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("accepts Nicaragua local whatsapp against stored +505 format", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_2",
      orderNumber: "P-LOCAL1",
      locationId: "loc_principal",
      type: "pickup",
      status: "new",
      customerName: "Ana",
      customerWhatsapp: "+50586791327",
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
    });

    const result = await trackOrder(
      { orderNumber: "P-LOCAL1", customerWhatsapp: "86791327" },
      { repository },
    );

    expect(result.data.orderNumber).toBe("P-LOCAL1");
  });

  it("tracks by orderLookupToken when provided", async () => {
    const repository = new InMemoryOrderRepository();
    const token = "validtoken123";
    repository.orders.push({
      id: "ord_3",
      orderNumber: "D-TOKEN1",
      locationId: "loc_principal",
      type: "delivery",
      status: "confirmed",
      customerName: "Maria",
      customerWhatsapp: "+50588881111",
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
      orderLookupTokenHash: hashOrderLookupToken(token),
    });

    const result = await trackOrder(
      { orderNumber: "D-TOKEN1", orderLookupToken: token },
      { repository },
    );

    expect(result.data.orderNumber).toBe("D-TOKEN1");
    expect(result.data.status).toBe("confirmed");
  });

  it("rejects invalid orderLookupToken", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_4",
      orderNumber: "D-TOKEN2",
      locationId: "loc_principal",
      type: "pickup",
      status: "new",
      customerName: "Luis",
      customerWhatsapp: "+50588882222",
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

    await expect(
      trackOrder(
        { orderNumber: "D-TOKEN2", orderLookupToken: "wrongtoken" },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("rejects orderLookupToken when order has no hash stored", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_5",
      orderNumber: "D-NOHASH",
      locationId: "loc_principal",
      type: "pickup",
      status: "new",
      customerName: "Pedro",
      customerWhatsapp: "+50588883333",
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

    await expect(
      trackOrder(
        { orderNumber: "D-NOHASH", orderLookupToken: "sometoken" },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("rejects when neither customerWhatsapp nor orderLookupToken is provided", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push({
      id: "ord_6",
      orderNumber: "D-NOTHING",
      locationId: "loc_principal",
      type: "pickup",
      status: "new",
      customerName: "Ana",
      customerWhatsapp: "+50586791327",
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
    });

    await expect(
      trackOrder({ orderNumber: "D-NOTHING" }, { repository }),
    ).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
  });
});
