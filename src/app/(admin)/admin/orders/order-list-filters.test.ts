import { describe, expect, it } from "vitest";

import {
  ALL_LOCATIONS,
  DEFAULT_ORDER_LIST_FILTERS,
  readOrderListFilters,
  writeOrderListFilters,
} from "@/app/(admin)/admin/orders/order-list-filters";

/**
 * `TASK-ORDERS-RUNTIME-5B` (`A-62`) — **los siete filtros viven en la URL**.
 *
 * El hallazgo era concreto: el filtro de estado se guardaba en el estado de React mientras la búsqueda, el
 * local y la forma de pago sí iban a la URL, así que recargar o compartir el enlace perdía el estado. Estos
 * casos fijan las dos mitades —leer y escribir— y el ciclo completo: lo que se lee es lo que se escribió.
 */
describe("readOrderListFilters", () => {
  it("sin parámetros arranca en Hoy, primera página y sin filtros", () => {
    expect(readOrderListFilters("")).toEqual(DEFAULT_ORDER_LIST_FILTERS);
  });

  it("lee los siete filtros", () => {
    const filters = readOrderListFilters(
      "?search=ana&date=30d&locationId=loc_norte&status=ready&payment=pending&scheduled=1&page=3",
    );

    expect(filters).toEqual({
      search: "ana",
      date: "30d",
      locationId: "loc_norte",
      status: "ready",
      payment: "pending",
      scheduledOnly: true,
      page: 3,
    });
  });

  it("un valor inválido cae al default en vez de viajar y volver como 400", () => {
    const filters = readOrderListFilters(
      "?date=la-semana-pasada&status=inventado&payment=regalado&page=-4",
    );

    expect(filters.date).toBe(DEFAULT_ORDER_LIST_FILTERS.date);
    expect(filters.status).toBe("all");
    expect(filters.payment).toBe("all");
    expect(filters.page).toBe(1);
  });

  it("la búsqueda se recorta", () => {
    expect(readOrderListFilters("?search=%20%20ana%20%20").search).toBe("ana");
  });
});

describe("writeOrderListFilters", () => {
  it("un filtro por defecto no se escribe: el enlace limpio es la ruta sola", () => {
    expect(writeOrderListFilters("", DEFAULT_ORDER_LIST_FILTERS)).toBe("");
  });

  it("escribe sólo lo que se aparta del default", () => {
    const query = writeOrderListFilters("", {
      ...DEFAULT_ORDER_LIST_FILTERS,
      search: "ana",
      payment: "pending",
    });

    expect(query).toBe("?search=ana&payment=pending");
    expect(query).not.toContain("date=");
    expect(query).not.toContain("page=");
  });

  it("la página 1 no se escribe, la 2 sí", () => {
    expect(writeOrderListFilters("", { ...DEFAULT_ORDER_LIST_FILTERS, page: 1 })).toBe("");
    expect(writeOrderListFilters("", { ...DEFAULT_ORDER_LIST_FILTERS, page: 2 })).toBe("?page=2");
  });

  it("escribe el filtro de estado: es el que se perdía (A-62)", () => {
    expect(writeOrderListFilters("", { ...DEFAULT_ORDER_LIST_FILTERS, status: "process" })).toBe(
      "?status=process",
    );
  });

  it("el ciclo completo no pierde nada: leer(escribir(x)) === x", () => {
    const filters = {
      search: "P-1059",
      date: "7d" as const,
      locationId: "loc_camino",
      status: "closed" as const,
      payment: "paid" as const,
      scheduledOnly: true,
      page: 4,
    };

    expect(readOrderListFilters(writeOrderListFilters("", filters))).toEqual(filters);
  });

  it("no borra parámetros ajenos que ya estuvieran en la URL", () => {
    expect(writeOrderListFilters("?otro=1", { ...DEFAULT_ORDER_LIST_FILTERS, search: "ana" })).toBe(
      "?otro=1&search=ana",
    );
  });

  it("`locationId` en `all` no viaja: el centinela se queda en la pantalla", () => {
    const query = writeOrderListFilters("", {
      ...DEFAULT_ORDER_LIST_FILTERS,
      locationId: ALL_LOCATIONS,
    });

    expect(query).toBe("");
  });
});
