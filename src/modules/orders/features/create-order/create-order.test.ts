import { describe, expect, it, vi } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";


import { createOrder as createOrderFeature } from "./create-order";

/**
 * T8: el pedido tiene que saber a qué local va. Todo pedido necesita un local, así que
 * los tests lo reciben por defecto ("Principal", el mismo que crea la migración) y los
 * casos de local lo pisan pasando su propio repositorio.
 */
function defaultLocationRepository(): LocationRepository {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
  ]);
}

type CreateOrderDeps = Parameters<typeof createOrderFeature>[1];

const createOrder = (
  input: Parameters<typeof createOrderFeature>[0],
  deps: Omit<CreateOrderDeps, "locationRepository"> & { locationRepository?: LocationRepository },
) => {
  const { locationRepository = defaultLocationRepository(), ...rest } = deps;

  return createOrderFeature(input, { ...rest, locationRepository });
};

function createRepository(): InMemoryOrderRepository {
  return new InMemoryOrderRepository();
}

function seedProduct(repository: InMemoryOrderRepository, overrides?: Partial<typeof repository.products[0]>) {
  const product = {
    id: "prod_01",
    name: "Cafe",
    basePrice: 100,
    packagingFeeAmount: null,
    categoryId: "cat_01",
    subcategoryId: null,
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
  it("encuentra el código aunque el cliente lo escriba en minúsculas (T9b)", async () => {
    const repository = createRepository();
    seedProduct(repository);
    repository.coupons.push({
      id: "coupon_b2g1",
      code: "B2G1",
      type: "percentage",
      value: 10,
      isActive: true,
      usageLimit: 0,
      usedCount: 0,
      expiresAt: null,
    });

    // El checkout valida el código tal como se escribe; el pedido tiene que
    // encontrarlo igual, o el cliente ve "sirve" y después el pedido falla.
    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        couponCode: " b2g1 ",
      },
      { repository },
    );

    expect(result.data.couponCode).toBe("B2G1");
    expect(result.data.discount).toBe(10);
  });

  it("un cupón sin límite de uso se puede usar (T9b)", async () => {
    const repository = createRepository();
    seedProduct(repository);
    repository.coupons.push({
      id: "coupon_ilimitado",
      code: "SINTOPE",
      type: "percentage",
      value: 10,
      isActive: true,
      // `usageLimit: 0` es el default del modelo y significa "sin límite": antes
      // esta combinación rechazaba cualquier pedido.
      usageLimit: 0,
      usedCount: 7,
      expiresAt: null,
    });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        couponCode: "SINTOPE",
      },
      { repository },
    );

    expect(result.data.discount).toBe(10);
    expect(repository.coupons[0].usedCount).toBe(8);
  });

  it("aplica una promo 2×1 sobre las unidades alcanzadas (T9)", async () => {
    const repository = createRepository();
    seedProduct(repository, { id: "prod_taco", name: "Taco", basePrice: 35, categoryId: "cat_tacos" });
    seedProduct(repository, { id: "prod_agua", name: "Agua", basePrice: 25, categoryId: "cat_bebidas" });
    repository.coupons.push({
      id: "coupon_bogo",
      code: "B2G1",
      type: "bogo",
      value: 0,
      isActive: true,
      usageLimit: 10,
      usedCount: 0,
      expiresAt: null,
      buyQuantity: 2,
      freeQuantity: 1,
      scopeType: "all",
      scopeId: null,
    });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [
          { productId: "prod_taco", quantity: 3, modifierOptionIds: [] },
          { productId: "prod_agua", quantity: 1, modifierOptionIds: [] },
        ],
        couponCode: "B2G1",
      },
      { repository },
    );

    // 3 tacos (35 c/u) con B2G1: uno sale gratis. El agua no entra.
    expect(result.data.subtotal).toBe(130);
    expect(result.data.discount).toBe(35);
    expect(result.data.total).toBe(95);
    expect(result.data.couponCode).toBe("B2G1");
  });

  it("la promo por alcance no descuenta lo que no alcanza (T9)", async () => {
    const repository = createRepository();
    seedProduct(repository, { id: "prod_taco", name: "Taco", basePrice: 35, categoryId: "cat_tacos" });
    seedProduct(repository, { id: "prod_agua", name: "Agua", basePrice: 25, categoryId: "cat_bebidas" });
    repository.coupons.push({
      id: "coupon_bogo",
      code: "TACOS2X1",
      type: "bogo",
      value: 0,
      isActive: true,
      usageLimit: 10,
      usedCount: 0,
      expiresAt: null,
      buyQuantity: 1,
      freeQuantity: 1,
      scopeType: "category",
      scopeId: "cat_tacos",
    });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [
          { productId: "prod_taco", quantity: 2, modifierOptionIds: [] },
          { productId: "prod_agua", quantity: 2, modifierOptionIds: [] },
        ],
        couponCode: "TACOS2X1",
      },
      { repository },
    );

    expect(result.data.discount).toBe(35);
  });

  it("rechaza la promo que no aplica sin quemar un uso (T9)", async () => {
    const repository = createRepository();
    seedProduct(repository, { id: "prod_taco", name: "Taco", basePrice: 35, categoryId: "cat_tacos" });
    repository.coupons.push({
      id: "coupon_bogo",
      code: "B2G1",
      type: "bogo",
      value: 0,
      isActive: true,
      usageLimit: 10,
      usedCount: 0,
      expiresAt: null,
      buyQuantity: 2,
      freeQuantity: 1,
      scopeType: "all",
      scopeId: null,
    });

    // Dos unidades no completan un bloque de tres: el código no aplica.
    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan Perez",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_taco", quantity: 2, modifierOptionIds: [] }],
          couponCode: "B2G1",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 409 });

    // El descuento se calcula antes de consumir: el uso sigue disponible.
    expect(repository.coupons[0].usedCount).toBe(0);
  });

  it("rechaza una promo mal configurada en vez de aplicarla a medias (T9)", async () => {
    const repository = createRepository();
    seedProduct(repository, { id: "prod_taco", name: "Taco", basePrice: 35, categoryId: "cat_tacos" });
    repository.coupons.push({
      id: "coupon_bogo",
      code: "ROTA",
      type: "bogo",
      value: 0,
      isActive: true,
      usageLimit: 10,
      usedCount: 0,
      expiresAt: null,
      buyQuantity: 2,
      freeQuantity: null,
      scopeType: "all",
      scopeId: null,
    });

    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan Perez",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_taco", quantity: 3, modifierOptionIds: [] }],
          couponCode: "ROTA",
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("misconfigured") });
  });

  it("genera un PIN de retiro para dictar en caja (T13)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository, pickupPinGenerator: () => "4821" },
    );

    // El PIN no identifica ni autoriza: es para dictarlo, y el generador se inyecta
    // igual que el del token de seguimiento.
    expect(result.data.pickupPin).toBe("4821");
  });

  it("sin generador inyectado igual devuelve un PIN válido (T13)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Ana Perez",
        customerWhatsapp: "+50588887778",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository },
    );

    expect(result.data.pickupPin).toMatch(/^\d{4}$/);
  });

  it("guarda con cuánto paga el cliente cuando es efectivo (T12)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const conVuelto = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
        paymentMethod: "cash",
        paidWithAmount: 500,
      },
      { repository },
    );
    // 2 × 100 = 200 de total, paga con 500.
    expect(conVuelto.data.paidWithAmount).toBe(500);
    expect(conVuelto.data.total).toBe(200);

    const sinMonto = await createOrder(
      {
        type: "pickup",
        customerName: "Ana Perez",
        customerWhatsapp: "+50588887778",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        paymentMethod: "cash",
      },
      { repository },
    );
    expect(sinMonto.data.paidWithAmount).toBeNull();
  });

  it("rechaza un monto que no alcanza y uno con tarjeta (T12)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const base = {
      type: "pickup" as const,
      customerName: "Juan Perez",
      customerWhatsapp: "+50588887777",
      items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
    };

    await expect(
      createOrder({ ...base, paymentMethod: "cash", paidWithAmount: 150 }, { repository }),
    ).rejects.toMatchObject({
      status: 400,
      fields: { paidWithAmount: expect.any(String) },
    });

    await expect(
      createOrder({ ...base, paymentMethod: "card", paidWithAmount: 500 }, { repository }),
    ).rejects.toMatchObject({
      status: 400,
      fields: { paidWithAmount: expect.any(String) },
    });

    expect(repository.orders).toHaveLength(0);
  });

  it("guarda la forma de pago y usa efectivo cuando no la mandan (T11)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const card = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        paymentMethod: "card",
      },
      { repository },
    );
    expect(card.data.paymentMethod).toBe("card");

    // El negocio cobra en el local: sin dato, lo más probable es el efectivo.
    const sinDato = await createOrder(
      {
        type: "pickup",
        customerName: "Ana Perez",
        customerWhatsapp: "+50588887778",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      },
      { repository },
    );
    expect(sinDato.data.paymentMethod).toBe("cash");
  });

  it("rechaza una forma de pago que no existe (T11)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan Perez",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          paymentMethod: "bitcoin" as never,
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 400,
      fields: { paymentMethod: expect.any(String) },
    });
    expect(repository.orders).toHaveLength(0);
  });

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
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.tipRate).toBeNull();
    expect(result.data.total).toBe(250);
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

  it("no aplica propina cuando la configuración del negocio la tiene apagada", async () => {
    const repository = createRepository();
    seedProduct(repository, { packagingFeeAmount: 10 });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        tipOptIn: true,
      },
      { repository, tipPolicy: { enabled: false, rate: 10 } },
    );

    expect(result.data.tipAmount).toBe(0);
    expect(result.data.tipRate).toBeNull();
  });

  it("usa el porcentaje de propina configurado en vez del 10 % por defecto", async () => {
    const repository = createRepository();
    seedProduct(repository, { packagingFeeAmount: 10 });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        tipOptIn: true,
      },
      { repository, tipPolicy: { enabled: true, rate: 15 } },
    );

    expect(result.data.subtotal).toBe(100);
    expect(result.data.tipAmount).toBe(15);
    expect(result.data.tipRate).toBe(15);
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
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.total).toBe(200);
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
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.total).toBe(150);
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

  it("does not apply a tip when the customer does not opt in", async () => {
    const repository = createRepository();
    seedProduct(repository, { packagingFeeAmount: 5 });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
      },
      { repository },
    );

    expect(result.data.packagingAmount).toBe(10);
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.tipRate).toBeNull();
    expect(result.data.total).toBe(210);
  });

  it("applies the 10% tip only when the customer explicitly opts in", async () => {
    const repository = createRepository();
    seedProduct(repository, { packagingFeeAmount: 5 });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan Perez",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
        tipOptIn: true,
      },
      { repository },
    );

    expect(result.data.tipAmount).toBe(20);
    expect(result.data.tipRate).toBe(10);
    expect(result.data.total).toBe(230);
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
    expect(result.data.tipAmount).toBe(0);
    expect(result.data.total).toBe(150);
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

  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** que autoriza quien administra la caja.
   *
   * Llega como **forma** (porcentaje o monto) y con su motivo; el monto lo calcula el servidor sobre el
   * subtotal que él mismo resolvió. Se compone con el cupón y nunca pasa de la venta.
   */
  it("aplica un descuento manual sobre el subtotal (9.7)", async () => {
    const repository = createRepository();
    seedProduct(repository, { basePrice: 100, packagingFeeAmount: 10 });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 2, modifierOptionIds: [] }],
        manualDiscount: { kind: "percentage", value: 10, reason: "Cliente de siempre" },
      },
      { repository },
    );

    expect(result.data.subtotal).toBe(200);
    // 10 % de 200; el empaque (20) se sigue pagando.
    expect(result.data.discount).toBe(20);
    expect(result.data.total).toBe(200);
  });

  it("el cupón y el descuento manual se suman sin pasar de la venta (9.7)", async () => {
    const repository = createRepository();
    seedProduct(repository, { basePrice: 100 });
    repository.coupons.push({
      id: "coupon_01",
      code: "MITAD",
      type: "fixed_amount",
      value: 150,
      isActive: true,
      usageLimit: 0,
      usedCount: 0,
      expiresAt: null,
    });

    const result = await createOrder(
      {
        type: "pickup",
        customerName: "Juan",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        couponCode: "MITAD",
        manualDiscount: { kind: "amount", value: 80, reason: "Cortesía" },
      },
      { repository },
    );

    // El cupón ya descontaba el subtotal entero: el manual no puede dejar el total en negativo.
    expect(result.data.subtotal).toBe(100);
    expect(result.data.discount).toBe(100);
    expect(result.data.total).toBe(0);
  });

  it("un descuento manual sin motivo se rechaza (9.7)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          manualDiscount: { kind: "percentage", value: 10, reason: "  " },
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("un descuento manual de más del 100 % se rechaza en vez de recortarse (9.7)", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          manualDiscount: { kind: "percentage", value: 120, reason: "Cortesía" },
        },
        { repository },
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("guarda si el retiro fue programado por el cliente o es lo antes posible", async () => {    const repository = createRepository();
    seedProduct(repository);

    const programado = await createOrder(
      {
        type: "pickup",
        customerName: "Juan",
        customerWhatsapp: "+50588887777",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        pickupTime: new Date("2026-09-11T20:00:00-06:00").toISOString(),
        pickupScheduled: true,
      },
      { repository },
    );
    expect(programado.data.pickupScheduled).toBe(true);
    expect(programado.data.pickupTime).toBe(
      new Date("2026-09-11T20:00:00-06:00").toISOString(),
    );

    const sinProgramar = await createOrder(
      {
        type: "pickup",
        customerName: "Ana",
        customerWhatsapp: "+50588887778",
        items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
        pickupTime: new Date("2026-09-11T19:35:00-06:00").toISOString(),
      },
      { repository },
    );
    expect(sinProgramar.data.pickupScheduled).toBe(false);
  });

  it("rejects a second concurrent order when the coupon limit is already consumed", async () => {
    const repository = createRepository();
    seedProduct(repository);
    repository.coupons.push({
      id: "coupon_01",
      code: "UNICA",
      type: "percentage",
      value: 10,
      isActive: true,
      usageLimit: 1,
      usedCount: 0,
      expiresAt: null,
    });

    const buildInput = () => ({
      type: "pickup" as const,
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      couponCode: "UNICA",
    });

    const results = await Promise.allSettled([
      createOrder(buildInput(), { repository }),
      createOrder(buildInput(), { repository }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(repository.coupons[0]?.usedCount).toBe(1);
  });

  it("returns the coupon slot when the order fails after consuming it", async () => {
    const repository = createRepository();
    seedProduct(repository);
    repository.coupons.push({
      id: "coupon_01",
      code: "BIENVENIDA10",
      type: "percentage",
      value: 10,
      isActive: true,
      usageLimit: 5,
      usedCount: 0,
      expiresAt: null,
    });

    const createOrderSpy = vi
      .spyOn(repository, "createOrder")
      .mockRejectedValueOnce(new Error("database down"));

    await expect(
      createOrder(
        {
          type: "pickup",
          customerName: "Juan",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
          couponCode: "BIENVENIDA10",
        },
        { repository },
      ),
    ).rejects.toThrow("database down");

    expect(repository.coupons[0]?.usedCount).toBe(0);
    createOrderSpy.mockRestore();
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

describe("createOrder · el local del pedido (T8)", () => {
  const segunda = createInMemoryLocation({ id: "loc_segunda", name: "Segunda", sortOrder: 1 });

  function pickupInput(locationId?: string | null) {
    return {
      type: "pickup" as const,
      customerName: "Juan Perez",
      customerWhatsapp: "+50588887777",
      items: [{ productId: "prod_01", quantity: 1, modifierOptionIds: [] }],
      ...(locationId === undefined ? {} : { locationId }),
    };
  }

  it("sin local elegido guarda el pedido en el primario", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const result = await createOrder(pickupInput(), { repository });

    expect(result.data.locationId).toBe("loc_principal");
  });

  it("guarda el pedido en el local que pidió el cliente", async () => {
    const repository = createRepository();
    seedProduct(repository);

    const result = await createOrder(pickupInput("loc_segunda"), {
      repository,
      locationRepository: new InMemoryLocationRepository([
        createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
        segunda,
      ]),
    });

    expect(result.data.locationId).toBe("loc_segunda");
  });

  it("un local que no existe se rechaza, no se cae al primario", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(pickupInput("loc_fantasma"), { repository }),
    ).rejects.toMatchObject({ status: 409, fields: { locationId: expect.any(String) } });
  });

  it("un local apagado se rechaza", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(pickupInput("loc_apagado"), {
        repository,
        locationRepository: new InMemoryLocationRepository([
          createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
          createInMemoryLocation({ id: "loc_apagado", name: "Apagado", isActive: false }),
        ]),
      }),
    ).rejects.toMatchObject({ status: 409, fields: { locationId: expect.any(String) } });
  });

  it("sin ningún local activo no se puede pedir", async () => {
    const repository = createRepository();
    seedProduct(repository);

    await expect(
      createOrder(pickupInput(), {
        repository,
        locationRepository: new InMemoryLocationRepository([
          createInMemoryLocation({ id: "loc_apagado", name: "Apagado", isActive: false }),
        ]),
      }),
    ).rejects.toMatchObject({ status: 409, fields: { locationId: expect.any(String) } });
  });
});
