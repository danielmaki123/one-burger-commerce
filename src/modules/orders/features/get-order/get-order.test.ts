import { describe, expect, it } from "vitest";

import { createInMemoryLocation, InMemoryLocationRepository } from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";

import { getOrder } from "./get-order";

/**
 * T8 fase 7 — el detalle del pedido dice de qué local sale.
 *
 * El nombre y la dirección se resuelven al leer y no se copian al pedido: si el owner
 * renombra el local o corrige la dirección, el detalle de un pedido viejo muestra el
 * dato nuevo. Un pedido cuyo local ya no existe queda sin punto de retiro en vez de
 * romper la pantalla.
 */
function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "ord_1",
    orderNumber: "P-ABC123",
    locationId: "loc_norte",
    type: "pickup",
    status: "new",
    customerName: "Daniel",
    customerWhatsapp: "+50588887777",
    items: [],
    subtotal: 0,
    discount: 0,
    packagingAmount: 0,
    deliveryFeeAmount: 0,
    tipAmount: 0,
    total: 0,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("getOrder (detalle del admin)", () => {
  it("agrega el punto de retiro del local del pedido", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push(order());

    const locationRepository = new InMemoryLocationRepository([
      createInMemoryLocation({
        id: "loc_norte",
        name: "Sucursal Norte",
        addressLine: "Frente al parque",
        city: "Managua",
      }),
    ]);

    const result = await getOrder("ord_1", {
      repository,
      locationRepository,
      paymentRepository: new InMemoryPaymentRepository(),
    });

    expect(result.data.orderNumber).toBe("P-ABC123");
    expect(result.data.pickupLocation).toEqual({
      name: "Sucursal Norte",
      addressLine: "Frente al parque",
      city: "Managua",
      addressReference: null,
      mapsUrl: null,
    });
  });

  it("sin el local cargado deja el punto de retiro en null", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push(order());

    const result = await getOrder("ord_1", {
      repository,
      locationRepository: new InMemoryLocationRepository(),
      paymentRepository: new InMemoryPaymentRepository(),
    });

    expect(result.data.pickupLocation).toBeNull();
  });

  it("sigue tirando 404 cuando el pedido no existe", async () => {
    await expect(
      getOrder("ord_fantasma", {
        repository: new InMemoryOrderRepository(),
        locationRepository: new InMemoryLocationRepository(),
        paymentRepository: new InMemoryPaymentRepository(),
      }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("trae los cobros registrados de la venta de mostrador (TASK-304)", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push(order({ total: 40 }));
    const paymentRepository = new InMemoryPaymentRepository();
    await paymentRepository.createPayment({
      orderId: "ord_1",
      method: "cash",
      amount: 100,
      currency: "NIO",
    });

    const result = await getOrder("ord_1", {
      repository,
      locationRepository: new InMemoryLocationRepository(),
      paymentRepository,
    });

    expect(result.data.payments).toHaveLength(1);
    expect(result.data.payments[0]).toMatchObject({ method: "cash", amount: 100, currency: "NIO" });
  });

  it("un pedido del checkout (pago al retirar) no tiene cobros", async () => {
    const repository = new InMemoryOrderRepository();
    repository.orders.push(order());

    const result = await getOrder("ord_1", {
      repository,
      locationRepository: new InMemoryLocationRepository(),
      paymentRepository: new InMemoryPaymentRepository(),
    });

    expect(result.data.payments).toEqual([]);
  });
});
