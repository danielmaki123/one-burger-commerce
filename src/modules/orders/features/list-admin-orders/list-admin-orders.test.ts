import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { listAdminOrders } from "@/modules/orders/features/list-admin-orders/list-admin-orders";
import type { OrderRecord } from "@/modules/orders/domain/order.types";

/**
 * T8 fase 7 — la lista de pedidos del admin, por local.
 *
 * Cada local tiene su cocina y su caja: el filtro deja ver solo lo de un local, y cada pedido
 * viaja con el **nombre** del local para que la pantalla no tenga que cruzarlo a mano.
 */
function order(overrides: Partial<OrderRecord> & { id: string; orderNumber: string }): OrderRecord {
  return {
    type: "pickup",
    status: "new",
    locationId: "loc_principal",
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
    ...overrides,
  };
}

function repository() {
  const repo = new InMemoryOrderRepository();
  repo.orders.push(
    order({ id: "ord_1", orderNumber: "P-1", locationId: "loc_principal" }),
    order({ id: "ord_2", orderNumber: "P-2", locationId: "loc_norte" }),
  );

  return repo;
}

function locations() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", sortOrder: 1 }),
  ]);
}

describe("listAdminOrders · por local (T8)", () => {
  it("sin filtro devuelve todos, cada uno con el nombre de su local", async () => {
    const result = await listAdminOrders({}, { repository: repository(), locationRepository: locations() });

    expect(result.data.map((entry) => entry.orderNumber)).toEqual(["P-1", "P-2"]);
    expect(result.data[0].locationName).toBe("Principal");
    expect(result.data[1].locationName).toBe("Norte");
  });

  it("con local devuelve solo los de ese local", async () => {
    const result = await listAdminOrders(
      { locationId: "loc_norte" },
      { repository: repository(), locationRepository: locations() },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].locationName).toBe("Norte");
    expect(result.meta.count).toBe(1);
  });

  it("un pedido de un local que ya no existe no rompe la lista", async () => {
    const repo = new InMemoryOrderRepository();
    repo.orders.push(order({ id: "ord_3", orderNumber: "P-3", locationId: "loc_fantasma" }));

    const result = await listAdminOrders(
      {},
      { repository: repo, locationRepository: locations() },
    );

    expect(result.data[0].locationName).toBeNull();
  });
});
