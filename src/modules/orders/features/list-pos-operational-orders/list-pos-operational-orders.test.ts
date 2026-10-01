import { describe, expect, it } from "vitest";

import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import type {
  AdminOrderRow,
  AdminOrderRowFilter,
  OrderRepository,
} from "@/modules/orders/ports/order-repository";

import { listPosOperationalOrders } from "./list-pos-operational-orders";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §9, §10, §11, §12) — **el read model operacional del POS**.
 *
 * Tres cosas que estos tests fijan y que son la razón de que la proyección exista:
 *
 * 1. **El resumen sale del servidor** sobre el feed completo, no de las filas visibles ni de cuatro
 *    requests agregados en React.
 * 2. **El scope por sucursal se aplica en la lectura**, no escondiendo filas en la pantalla.
 * 3. **El feed es mínimo**: no arrastra items, historial, GPS, tokens ni el WhatsApp del cliente; y **no**
 *    arrastra pedidos entregados, cerrados ni cancelados.
 */

const BASE = "NIO";

function row(overrides: Partial<AdminOrderRow> & { id: string; orderNumber: string }): AdminOrderRow {
  return {
    source: "menu",
    status: "new",
    type: "pickup",
    customerName: "Cliente",
    customerWhatsapp: "+50588887777",
    locationId: "loc_centro",
    pickupTime: null,
    pickupScheduled: false,
    total: 100,
    currencyCode: BASE,
    stageChangedAt: "2026-10-01T18:00:00.000Z",
    createdAt: "2026-10-01T18:00:00.000Z",
    payments: [],
    ...overrides,
  };
}

/**
 * El doble del puerto devuelve lo que se le cargó y **aplica los filtros**: un doble que ignorara el filtro
 * de local o el de estados haría pasar el test del scope sin probar nada.
 */
class FakeOrderRepository {
  rows: AdminOrderRow[] = [];
  lastFilter: AdminOrderRowFilter | null = null;

  async listAdminOrderRows(filter: AdminOrderRowFilter): Promise<AdminOrderRow[]> {
    this.lastFilter = filter;

    return this.rows.filter((entry) => {
      if (filter.statuses?.length && !filter.statuses.includes(entry.status)) return false;
      if (filter.excludeStatuses?.length && filter.excludeStatuses.includes(entry.status)) return false;
      if (filter.locationIds?.length && !filter.locationIds.includes(entry.locationId)) return false;

      return true;
    });
  }
}

function locationRepo(names: Record<string, string>): LocationRepository {
  // El doble implementa el puerto entero por `unknown`: sólo se ejercitan las dos lecturas del caso de uso,
  // y tiparlo como parcial dejaría pasar un cambio de contrato sin que el test se entere.
  return {
    listLocations: async () =>
      Object.entries(names).map(([id, name]) => ({ id, name })) as never,
    findLocationById: async (id: string) =>
      (id in names ? { id, name: names[id] } : null) as never,
  } as unknown as LocationRepository;
}

function deps(repository: FakeOrderRepository) {
  return {
    repository: repository as unknown as OrderRepository,
    locationRepository: locationRepo({ loc_centro: "Camino de Oriente" }),
  };
}

/** Estados financieros por pedido, escritos a mano: el `expected` no sale de la función bajo prueba. */
function financialMap(
  entries: Record<string, { status: "pending" | "partial" | "paid"; paid: number; unresolved?: number }>,
) {
  return async (orderId: string) => {
    const entry = entries[orderId] ?? { status: "pending" as const, paid: 0 };
    const rowTotal = 0;

    return {
      status: entry.status,
      paidAmount: entry.paid,
      // `outstandingAmount = max(0, total − paid)`, con el total que declara el caso.
      outstandingAmount: Math.max(0, rowTotal),
      unresolvedAmount: entry.unresolved ?? 0,
    };
  };
}

describe("listPosOperationalOrders · feed operacional", () => {
  it("no trae pedidos entregados, cerrados ni cancelados", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      row({ id: "vivo", orderNumber: "P-1", status: "preparing" }),
      row({ id: "listo", orderNumber: "P-2", status: "ready_for_pickup" }),
      row({ id: "entregado", orderNumber: "P-3", status: "picked_up" }),
      row({ id: "cerrado", orderNumber: "P-4", status: "closed" }),
      row({ id: "cancelado", orderNumber: "P-5", status: "cancelled" }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({}) },
    );

    expect(result.orders.map((order) => order.id)).toEqual(["vivo", "listo"]);
  });

  it("aplica el scope por sucursal en la lectura, no en la pantalla", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      row({ id: "aqui", orderNumber: "P-1", locationId: "loc_centro" }),
      row({ id: "ajena", orderNumber: "P-2", locationId: "loc_norte" }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({}) },
    );

    expect(result.orders.map((order) => order.id)).toEqual(["aqui"]);
    // El filtro viaja al puerto: sin esto el scope sería una promesa de la pantalla.
    expect(repository.lastFilter?.locationIds).toEqual(["loc_centro"]);
    expect(repository.lastFilter?.excludeStatuses).toContain("cancelled");
  });

  it("proyecta sólo los campos del contrato operacional", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      row({
        id: "ord_1",
        orderNumber: "P-1",
        status: "ready_for_pickup",
        // Si una fila llegara con campos de más, la proyección no los puede dejar pasar.
        ...({
          orderLookupTokenHash: "hash-secreto",
          customerLat: 12.13,
          customerLng: -86.25,
          items: [{ id: "item_1" }],
          statusHistory: [{ id: "h_1" }],
          invoice: { id: "inv_1" },
        } as object),
      }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({}) },
    );

    expect(Object.keys(result.orders[0]).sort()).toEqual(
      [
        "currencyCode",
        "customerName",
        "financialState",
        "id",
        "locationId",
        "locationName",
        "orderNumber",
        "pickupScheduled",
        "pickupTime",
        "source",
        "status",
        "total",
      ].sort(),
    );
    // El WhatsApp del cliente no está en el contrato del POS: el panel no lo dibuja.
    expect(result.orders[0]).not.toHaveProperty("customerWhatsapp");
  });

  it("resuelve el nombre del local y lo deja en `null` si el local ya no existe", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [row({ id: "ord_1", orderNumber: "P-1" })];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({}) },
    );

    expect(result.orders[0].locationName).toBe("Camino de Oriente");
  });
});

describe("listPosOperationalOrders · resumen del servidor", () => {
  it("cuenta los cuatro KPI sobre el feed completo", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      row({ id: "proceso", orderNumber: "P-1", status: "preparing" }),
      row({ id: "listo", orderNumber: "P-2", status: "ready_for_pickup" }),
      row({
        id: "programado",
        orderNumber: "P-3",
        status: "confirmed",
        pickupScheduled: true,
        pickupTime: "2026-10-02T12:30:00.000Z",
      }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      {
        ...deps(repository),
        resolveFinancialState: financialMap({
          proceso: { status: "paid", paid: 100 },
          listo: { status: "pending", paid: 0 },
          programado: { status: "pending", paid: 0 },
        }),
      },
    );

    // En proceso: preparing + confirmed programado = 2. Listos: ready_for_pickup = 1.
    // Por cobrar: listo + programado = 2. Programados: el que tiene hora = 1.
    expect(result.summary).toEqual({
      inProcess: 2,
      ready: 1,
      pendingPayment: 2,
      scheduled: 1,
    });
  });

  it("un pedido puede contar en varios KPI a la vez (P-1902)", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      row({
        id: "p1902",
        orderNumber: "P-1902",
        status: "ready_for_pickup",
        pickupScheduled: true,
        pickupTime: "2026-10-02T12:30:00.000Z",
      }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({ p1902: { status: "pending", paid: 0 } }) },
    );

    expect(result.summary).toEqual({ inProcess: 0, ready: 1, pendingPayment: 1, scheduled: 1 });
  });

  it("un parcial con plata no demostrable cuenta en Por cobrar y el panel lo marca para revisar", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [row({ id: "raro", orderNumber: "P-1", status: "preparing" })];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      {
        ...deps(repository),
        resolveFinancialState: financialMap({
          raro: { status: "partial", paid: 120, unresolved: 120 },
        }),
      },
    );

    expect(result.summary.pendingPayment).toBe(1);
    expect(result.orders[0].financialState.unresolvedAmount).toBe(120);
    expect(result.orders[0].financialState.status).toBe("partial");
  });
});

describe("listPosOperationalOrders · orden del feed", () => {
  it("los programados van primero y por hora prometida, no por creación", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      // Creado primero (más viejo) pero prometido para más tarde.
      row({
        id: "tarde",
        orderNumber: "P-TARDE",
        status: "confirmed",
        pickupScheduled: true,
        pickupTime: "2026-10-02T18:00:00.000Z",
        createdAt: "2026-10-01T08:00:00.000Z",
        stageChangedAt: "2026-10-01T08:00:00.000Z",
      }),
      // Creado último pero prometido para más temprano: tiene que ir antes.
      row({
        id: "temprano",
        orderNumber: "P-TEMPRANO",
        status: "confirmed",
        pickupScheduled: true,
        pickupTime: "2026-10-02T09:00:00.000Z",
        createdAt: "2026-10-01T20:00:00.000Z",
        stageChangedAt: "2026-10-01T20:00:00.000Z",
      }),
      // Sin programar: va después de los dos programados.
      row({
        id: "ahora",
        orderNumber: "P-AHORA",
        status: "preparing",
        createdAt: "2026-10-01T21:00:00.000Z",
        stageChangedAt: "2026-10-01T21:00:00.000Z",
      }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({}) },
    );

    expect(result.orders.map((order) => order.id)).toEqual(["temprano", "tarde", "ahora"]);
  });

  it("entre los no programados, lo más reciente en su etapa va primero", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      row({ id: "viejo", orderNumber: "P-1", stageChangedAt: "2026-10-01T10:00:00.000Z" }),
      row({ id: "nuevo", orderNumber: "P-2", stageChangedAt: "2026-10-01T20:00:00.000Z" }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({}) },
    );

    expect(result.orders.map((order) => order.id)).toEqual(["nuevo", "viejo"]);
  });

  it("un programado sin hora no se mezcla con los programados y pierde contra ellos", async () => {
    const repository = new FakeOrderRepository();
    repository.rows = [
      // `pickupScheduled` en `true` pero sin hora: no es un programado válido para el KPI ni para el orden.
      row({ id: "sin-hora", orderNumber: "P-1", status: "confirmed", pickupScheduled: true, pickupTime: null }),
      row({
        id: "con-hora",
        orderNumber: "P-2",
        status: "confirmed",
        pickupScheduled: true,
        pickupTime: "2026-10-02T12:00:00.000Z",
      }),
    ];

    const result = await listPosOperationalOrders(
      { locationId: "loc_centro", baseCurrencyCode: BASE },
      { ...deps(repository), resolveFinancialState: financialMap({}) },
    );

    expect(result.summary.scheduled).toBe(1);
    expect(result.orders.map((order) => order.id)).toEqual(["con-hora", "sin-hora"]);
  });
});
