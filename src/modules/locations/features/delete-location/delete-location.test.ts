import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { deleteLocation } from "@/modules/locations/features/delete-location/delete-location";
import type { OrderRecord } from "@/modules/orders/domain/order.types";

/**
 * T8 fase 2/7 — borrar un local.
 *
 * Tres reglas que evitan dejar el negocio sin dónde despachar o perder historia: no se puede
 * borrar el último local activo, no se puede dejar la lista vacía y **no se puede borrar un
 * local con pedidos** (la base lo impide con una FK, así que el usuario tiene que recibir el
 * motivo y no un 500).
 */
function locations() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", sortOrder: 1 }),
    createInMemoryLocation({
      id: "loc_viejo",
      name: "Viejo",
      slug: "viejo",
      sortOrder: 2,
      isActive: false,
    }),
  ]);
}

function orderFor(locationId: string) {
  const repository = new InMemoryOrderRepository();
  repository.orders.push({
    id: "ord_1",
    orderNumber: "P-1",
    type: "pickup",
    status: "closed",
    locationId,
    customerName: "Cliente",
    customerWhatsapp: "+50588887777",
    items: [],
    subtotal: 100,
    discount: 0,
    packagingAmount: 0,
    deliveryFeeAmount: 0,
    tipAmount: 0,
    total: 100,
    createdAt: "2026-09-12T18:00:00.000Z",
    updatedAt: "2026-09-12T18:00:00.000Z",
  } satisfies OrderRecord);

  return repository;
}

describe("deleteLocation", () => {
  it("borra un local que no es el último y no tiene pedidos", async () => {
    const repository = locations();

    await deleteLocation("loc_norte", { repository, orderRepository: new InMemoryOrderRepository() });

    expect(await repository.findLocationById("loc_norte")).toBeNull();
  });

  it("borra un local apagado si queda otro activo", async () => {
    const repository = locations();

    await deleteLocation("loc_viejo", { repository, orderRepository: new InMemoryOrderRepository() });

    expect(await repository.findLocationById("loc_viejo")).toBeNull();
  });

  it("no deja borrar el último local activo", async () => {
    const repository = new InMemoryLocationRepository([
      createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    ]);

    await expect(
      deleteLocation("loc_principal", { repository, orderRepository: new InMemoryOrderRepository() }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await repository.listLocations()).toHaveLength(1);
  });

  it("no deja borrar un local con pedidos, y lo dice con el motivo", async () => {
    // La base lo impide igual (FK `Restrict`), pero un 500 no le sirve a nadie: el owner
    // tiene que saber que ese local tiene historia y que puede apagarlo en vez de borrarlo.
    const repository = locations();

    await expect(
      deleteLocation("loc_norte", {
        repository,
        orderRepository: orderFor("loc_norte"),
      }),
    ).rejects.toMatchObject({ status: 409, fields: { id: expect.stringContaining("pedido") } });

    expect(await repository.findLocationById("loc_norte")).not.toBeNull();
  });

  it("no encuentra un local que no existe", async () => {
    await expect(
      deleteLocation("loc_fantasma", {
        repository: locations(),
        orderRepository: new InMemoryOrderRepository(),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
