import { describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";


import { addTableOrderItems } from "./add-table-order-items";

function createRepository(): InMemoryOrderRepository {
  return new InMemoryOrderRepository();
}

describe("addTableOrderItems", () => {
  it("adds items to an existing table order and recalculates totals", async () => {
    const repository = createRepository();
    repository.products.push({
      id: "prod_01",
      name: "Cafe",
      basePrice: 100,
      packagingFeeAmount: 10,
       categoryId: "cat_01",
       subcategoryId: null,
      isActive: true,
      isAvailable: true,
      modifierGroups: [],
    });
    repository.products.push({
      id: "prod_02",
      name: "Te",
      basePrice: 50,
      packagingFeeAmount: 7,
       categoryId: "cat_01",
       subcategoryId: null,
      isActive: true,
      isAvailable: true,
      modifierGroups: [],
    });
    repository.orders.push({
      id: "ord_01",
      orderNumber: "T-1",
      locationId: "loc_principal",
      type: "table",
      status: "accepted",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [
        {
          id: "item_1",
          productId: "prod_01",
          productName: "Cafe",
          quantity: 1,
          unitPrice: 100,
          packagingUnitAmount: 0,
          packagingQuantity: 0,
          packagingTotalAmount: 0,
          notes: null,
          lineTotal: 100,
          modifiers: [],
        },
      ],
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

    const result = await addTableOrderItems(
      "ord_01",
      { items: [{ productId: "prod_02", quantity: 2, modifierOptionIds: [] }] },
      { repository },
    );

    expect(result.data.items.length).toBe(2);
    expect(result.data.subtotal).toBe(200);
    expect(result.data.packagingAmount).toBe(0);
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.tipRate).toBeNull();
    expect(result.data.items[1].packagingTotalAmount).toBe(0);
    expect(result.data.total).toBe(200);
  });

  it("rejects adding items to a closed table order", async () => {
    const repository = createRepository();
    repository.products.push({
      id: "prod_01",
      name: "Cafe",
      basePrice: 100,
      packagingFeeAmount: 10,
       categoryId: "cat_01",
       subcategoryId: null,
      isActive: true,
      isAvailable: true,
      modifierGroups: [],
    });
    repository.orders.push({
      id: "ord_01",
      orderNumber: "T-1",
      locationId: "loc_principal",
      type: "table",
      status: "closed",
      customerName: "Juan",
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
      addTableOrderItems(
        "ord_01",
        { items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }] },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects adding items to a delivery order", async () => {
    const repository = createRepository();
    repository.products.push({
      id: "prod_01",
      name: "Cafe",
      basePrice: 100,
      packagingFeeAmount: 10,
       categoryId: "cat_01",
       subcategoryId: null,
      isActive: true,
      isAvailable: true,
      modifierGroups: [],
    });
    repository.orders.push({
      id: "ord_01",
      orderNumber: "D-1",
      locationId: "loc_principal",
      type: "delivery",
      status: "new",
      customerName: "Juan",
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
      addTableOrderItems(
        "ord_01",
        { items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }] },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });
});
