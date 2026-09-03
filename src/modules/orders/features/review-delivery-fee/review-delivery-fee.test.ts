import { describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";

import { reviewDeliveryFee } from "./review-delivery-fee";

function createRepository(): InMemoryOrderRepository {
  return new InMemoryOrderRepository();
}

describe("reviewDeliveryFee", () => {
  it("confirms delivery fee and recalculates total for delivery order", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "D-1",
      type: "delivery",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 200,
      discount: 20,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      deliveryFeeStatus: "pending_manual_validation",
      tipAmount: 0,
      tipRate: null,
      total: 180,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await reviewDeliveryFee(
      "ord_01",
      { deliveryFeeAmount: 35, deliveryFeeStatus: "confirmed" },
      { repository },
    );

    expect(result.data.deliveryFeeAmount).toBe(35);
    expect(result.data.deliveryFeeStatus).toBe("confirmed");
    expect(result.data.total).toBe(215);
  });

  it("rejects negative delivery fee amount", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "D-1",
      type: "delivery",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      deliveryFeeStatus: "pending_manual_validation",
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      reviewDeliveryFee("ord_01", { deliveryFeeAmount: -10, deliveryFeeStatus: "confirmed" }, { repository }),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects invalid delivery fee status", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "D-1",
      type: "delivery",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      deliveryFeeStatus: "pending_manual_validation",
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      reviewDeliveryFee(
        "ord_01",
        { deliveryFeeAmount: 25, deliveryFeeStatus: "invalid_status" as never },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("returns 404 for missing order", async () => {
    const repository = createRepository();
    await expect(
      reviewDeliveryFee("ord_missing", { deliveryFeeAmount: 25, deliveryFeeStatus: "confirmed" }, { repository }),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("rejects delivery fee update for pickup order", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_02",
      orderNumber: "P-1",
      type: "pickup",
      status: "new",
      customerName: "Ana",
      customerWhatsapp: "+50588889999",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      reviewDeliveryFee("ord_02", { deliveryFeeAmount: 25, deliveryFeeStatus: "confirmed" }, { repository }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects pending status with non-zero amount", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_04",
      orderNumber: "D-4",
      type: "delivery",
      status: "new",
      customerName: "Luis",
      customerWhatsapp: "+50588881111",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 30,
      deliveryFeeStatus: "confirmed",
      tipAmount: 0,
      tipRate: null,
      total: 130,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      reviewDeliveryFee(
        "ord_04",
        { deliveryFeeAmount: 15, deliveryFeeStatus: "pending_manual_validation" },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("reverts fee to pending with zero amount", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_03",
      orderNumber: "D-3",
      type: "delivery",
      status: "new",
      customerName: "Pedro",
      customerWhatsapp: "+50588880000",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 30,
      deliveryFeeStatus: "confirmed",
      tipAmount: 0,
      tipRate: null,
      total: 130,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await reviewDeliveryFee(
      "ord_03",
      { deliveryFeeAmount: 0, deliveryFeeStatus: "pending_manual_validation" },
      { repository },
    );

    expect(result.data.deliveryFeeAmount).toBe(0);
    expect(result.data.deliveryFeeStatus).toBe("pending_manual_validation");
    expect(result.data.total).toBe(100);
  });
});
