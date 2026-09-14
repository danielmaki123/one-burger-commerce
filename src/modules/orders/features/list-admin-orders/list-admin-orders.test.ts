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
      { locationIds: ["loc_norte"] },
      { repository: repository(), locationRepository: locations() },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].locationName).toBe("Norte");
    expect(result.meta.count).toBe(1);
  });

  it("con varias sucursales (alcance del usuario) devuelve solo las suyas (A)", async () => {
    const repo = new InMemoryOrderRepository();
    repo.orders.push(
      order({ id: "ord_1", orderNumber: "P-1", locationId: "loc_principal" }),
      order({ id: "ord_2", orderNumber: "P-2", locationId: "loc_norte" }),
      order({ id: "ord_3", orderNumber: "P-3", locationId: "loc_sur" }),
    );

    const result = await listAdminOrders(
      { locationIds: ["loc_norte", "loc_sur"] },
      { repository: repo, locationRepository: locations() },
    );

    expect(result.data.map((entry) => entry.orderNumber)).toEqual(["P-2", "P-3"]);
  });

  it("una lista de sucursales vacía no filtra nada (sin asignar = ve todas)", async () => {
    const result = await listAdminOrders(
      { locationIds: [] },
      { repository: repository(), locationRepository: locations() },
    );

    expect(result.data).toHaveLength(2);
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

/**
 * B3 — cuándo empezó la etapa actual de cada pedido.
 *
 * La urgencia de la comanda (a los 10 y a los 15 minutos) se mide **dentro de la etapa**, no desde
 * que entró el pedido: un pedido aceptado hace 20 minutos y en preparación hace 2 no está atrasado.
 * Ese instante sale de `OrderStatusHistory` —no de `updatedAt`, que también cambia cuando alguien
 * toca el pedido por otro motivo— y tiene que venir en la **misma lectura** de la lista: la pantalla
 * no puede pedir el historial de veinte pedidos uno por uno.
 */
describe("listAdminOrders · el tiempo en la etapa (B3)", () => {
  function repoWithOrder() {
    const repo = new InMemoryOrderRepository();
    repo.orders.push(
      order({
        id: "ord_1",
        orderNumber: "P-1",
        status: "preparing",
        createdAt: "2026-09-12T18:00:00.000Z",
        updatedAt: "2026-09-12T18:05:00.000Z",
      }),
    );

    return repo;
  }

  function history(id: string, status: string, createdAt: string) {
    return { id, orderId: "ord_1", status: status as never, note: null, createdAt };
  }

  it("usa el último cambio de estado, no el primero ni la última edición", async () => {
    const repo = repoWithOrder();
    repo.statusHistory.push(
      history("h1", "confirmed", "2026-09-12T18:10:00.000Z"),
      history("h2", "preparing", "2026-09-12T18:24:00.000Z"),
    );

    const result = await listAdminOrders(
      {},
      { repository: repo, locationRepository: locations() },
    );

    expect(result.data[0].stageChangedAt).toBe("2026-09-12T18:24:00.000Z");
  });

  it("sin historial, la etapa empezó con el pedido", async () => {
    const result = await listAdminOrders(
      {},
      { repository: repoWithOrder(), locationRepository: locations() },
    );

    expect(result.data[0].stageChangedAt).toBe("2026-09-12T18:00:00.000Z");
  });
});

/**
 * B4 — buscar una comanda en el turno.
 *
 * Lo que se busca es lo que la persona tiene a mano cuando pregunta: el número que se dictó por
 * teléfono, el nombre, el WhatsApp desde el que escribió o el PIN que está esperando en el mostrador.
 * El filtro vive en el servidor —la lista puede ser larga y el celular de la cocina no puede
 * bajarla entera para filtrarla— y **no** cambia el alcance por sucursal.
 */
describe("listAdminOrders · búsqueda (B4)", () => {
  function repoWithThree() {
    const repo = new InMemoryOrderRepository();
    repo.orders.push(
      order({
        id: "ord_1",
        orderNumber: "P-ABC123",
        customerName: "Ana Pérez",
        // Un WhatsApp que **no** comparta dígitos con el de Bruno: si no, el caso de "los últimos
        // dígitos" pasaría por el pedido equivocado y no probaría nada.
        customerWhatsapp: "+50588881234",
        pickupPin: "4821",
      }),
      order({
        id: "ord_2",
        orderNumber: "P-XYZ789",
        customerName: "Bruno López",
        customerWhatsapp: "+50577776666",
        pickupPin: "9137",
      }),
      order({
        id: "ord_3",
        orderNumber: "D-555AAA",
        customerName: "Carla Ruiz",
        customerWhatsapp: "+50566665555",
        pickupPin: "2048",
      }),
    );

    return repo;
  }

  async function search(term: string) {
    const result = await listAdminOrders(
      { search: term },
      { repository: repoWithThree(), locationRepository: locations() },
    );

    return result.data.map((entry) => entry.orderNumber);
  }

  it("por número de pedido, sin importar mayúsculas ni espacios", async () => {
    expect(await search("  p-abc  ")).toEqual(["P-ABC123"]);
    expect(await search("xyz")).toEqual(["P-XYZ789"]);
  });

  it("por nombre del cliente", async () => {
    expect(await search("bruno")).toEqual(["P-XYZ789"]);
    expect(await search("Pérez")).toEqual(["P-ABC123"]);
  });

  it("por WhatsApp completo o por los últimos dígitos", async () => {
    expect(await search("+50577776666")).toEqual(["P-XYZ789"]);
    expect(await search("7777")).toEqual(["P-XYZ789"]);
  });

  it("por el PIN que el cliente dicta en el mostrador", async () => {
    expect(await search("4821")).toEqual(["P-ABC123"]);
  });

  it("varios resultados no se pisan entre sí", async () => {
    expect(await search("P-")).toEqual(["P-ABC123", "P-XYZ789"]);
  });

  it("sin resultados devuelve vacío, no todo", async () => {
    expect(await search("zzzz")).toEqual([]);
  });

  it("una búsqueda vacía no filtra nada", async () => {
    expect((await search("   ")).length).toBe(3);
  });

  it("la búsqueda se combina con el alcance por sucursal", async () => {
    const repo = repoWithThree();
    repo.orders[0].locationId = "loc_norte";

    const result = await listAdminOrders(
      { search: "P-", locationIds: ["loc_norte"] },
      { repository: repo, locationRepository: locations() },
    );

    expect(result.data.map((entry) => entry.orderNumber)).toEqual(["P-ABC123"]);
  });
});
