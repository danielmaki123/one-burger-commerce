import { describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";


import { updateOrderStatus } from "./update-order-status";

function createRepository(): InMemoryOrderRepository {
  return new InMemoryOrderRepository();
}

describe("updateOrderStatus", () => {
  it("allows valid delivery transition new -> confirmed", async () => {
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
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await updateOrderStatus("ord_01", { status: "confirmed", note: "ok" }, { repository });
    expect(result.data.status).toBe("confirmed");
    expect(result.meta.note).toBe("ok");
  });

  it("rejects invalid transition new -> closed for delivery", async () => {
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
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      updateOrderStatus("ord_01", { status: "closed" }, { repository }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects invalid transition for table new -> served", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "T-1",
      type: "table",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
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
      updateOrderStatus("ord_01", { status: "served" }, { repository }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("returns 404 for missing order", async () => {
    const repository = createRepository();
    await expect(
      updateOrderStatus("ord_missing", { status: "confirmed" }, { repository }),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("allows cancelling from preparing with required note", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_02",
      orderNumber: "D-2",
      type: "delivery",
      status: "preparing",
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

    const result = await updateOrderStatus("ord_02", { status: "cancelled", note: "Cliente cancelo" }, { repository });
    expect(result.data.status).toBe("cancelled");
  });

  it("rejects cancelled transition without note", async () => {
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
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      updateOrderStatus("ord_03", { status: "cancelled" }, { repository }),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});
