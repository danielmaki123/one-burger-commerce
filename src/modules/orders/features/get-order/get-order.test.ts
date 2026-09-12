import { describe, expect, it } from "vitest";

import { createInMemoryLocation, InMemoryLocationRepository } from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
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

    const result = await getOrder("ord_1", { repository, locationRepository });

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
    });

    expect(result.data.pickupLocation).toBeNull();
  });

  it("sigue tirando 404 cuando el pedido no existe", async () => {
    await expect(
      getOrder("ord_fantasma", {
        repository: new InMemoryOrderRepository(),
        locationRepository: new InMemoryLocationRepository(),
      }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
