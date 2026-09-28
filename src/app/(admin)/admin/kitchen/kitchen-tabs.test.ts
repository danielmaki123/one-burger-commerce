import { describe, expect, it } from "vitest";

import {
  filterKitchenOrders,
  KITCHEN_FILTERS,
  type KitchenFilterableOrder,
} from "./kitchen-tabs";

/**
 * Los filtros del tablero de **Cocina**.
 *
 * La spec de Cocina **no** tiene los cinco tabs del modo cocina viejo («Todas», «Nuevas», «Preparando»,
 * «Listas», «Despachadas hace poco»): esos eran de la pantalla de Órdenes, donde la cocina compartía
 * superficie con el mostrador. Acá los carriles **son** el contenido y el único filtro de estado que la
 * spec pide es **«Solo atrasadas»** (toolbar) sobre los tres carriles.
 *
 * Lo que sí queda es el **filtro por carril** que el conmutador usa en tablet y celular —ahí se ve un
 * carril por vez— y la búsqueda. Los dos son presentación sobre lo que la pantalla ya tiene: no piden
 * nada nuevo al servidor.
 */

const NOW = Date.parse("2026-09-12T18:00:00.000Z");

function order(over: Partial<KitchenFilterableOrder> & { id: string }): KitchenFilterableOrder {
  return {
    status: "new",
    orderNumber: `P-${over.id.toUpperCase()}`,
    customerName: `Cliente ${over.id}`,
    stageChangedAt: "2026-09-12T17:00:00.000Z",
    ...over,
  };
}

describe("kitchen-tabs · los filtros de la cocina", () => {
  it("son cuatro, en el orden del tablero, y cada uno dice su carril", () => {
    expect(KITCHEN_FILTERS.map((filter) => filter.id)).toEqual([
      "all",
      "entry",
      "preparing",
      "ready",
    ]);
    expect(KITCHEN_FILTERS.map((filter) => filter.label)).toEqual([
      "Todas",
      "Por aceptar",
      "Preparando",
      "Listos",
    ]);
    // «Todas» no filtra carril; los otros tres sí, y quedan alineados con el mapa canónico.
    expect(KITCHEN_FILTERS.map((filter) => filter.lane)).toEqual([
      null,
      "entry",
      "preparing",
      "ready",
    ]);
  });
});

describe("kitchen-tabs · filtrar la cola", () => {
  const orders = [
    order({ id: "nueva", status: "new" }),
    order({ id: "aceptada", status: "confirmed" }),
    order({ id: "enFuego", status: "preparing" }),
    order({ id: "lista", status: "ready_for_pickup" }),
  ];

  it("«Todas» no filtra nada y conserva el orden", () => {
    expect(filterKitchenOrders(orders, { filter: "all" }).map((o) => o.id)).toEqual([
      "nueva",
      "aceptada",
      "enFuego",
      "lista",
    ]);
  });

  it("cada carril trae su estado y su equivalente, y nada más", () => {
    expect(filterKitchenOrders(orders, { filter: "entry" }).map((o) => o.id)).toEqual([
      "nueva",
      "aceptada",
    ]);
    expect(filterKitchenOrders(orders, { filter: "preparing" }).map((o) => o.id)).toEqual([
      "enFuego",
    ]);
    expect(filterKitchenOrders(orders, { filter: "ready" }).map((o) => o.id)).toEqual(["lista"]);
  });

  it("un filtro desconocido no deja la pantalla en blanco", () => {
    expect(filterKitchenOrders(orders, { filter: "no-existe" })).toHaveLength(4);
  });

  it("la búsqueda filtra por número o cliente, sin importar mayúsculas", () => {
    expect(
      filterKitchenOrders(orders, { filter: "all", search: "p-enf" }).map((o) => o.id),
    ).toEqual(["enFuego"]);
    expect(
      filterKitchenOrders(orders, { filter: "all", search: "cliente lista" }).map((o) => o.id),
    ).toEqual(["lista"]);
    expect(filterKitchenOrders(orders, { filter: "all", search: "nadie" })).toEqual([]);
  });

  it("«Solo atrasadas» deja lo que pasó el umbral de su etapa", () => {
    const late = [
      order({
        id: "vieja",
        status: "preparing",
        // 24 minutos en preparando: pasado el umbral de cocina.
        stageChangedAt: new Date(NOW - 24 * 60_000).toISOString(),
      }),
      order({
        id: "fresca",
        status: "preparing",
        stageChangedAt: new Date(NOW - 2 * 60_000).toISOString(),
      }),
    ];

    expect(
      filterKitchenOrders(late, {
        filter: "all",
        lateOnly: true,
        thresholds: { entry: { warningMinutes: 10, lateMinutes: 15 }, kitchen: { warningMinutes: 15, lateMinutes: 20 } },
        nowMs: NOW,
      }).map((o) => o.id),
    ).toEqual(["vieja"]);
  });

  it("la entrada mide con el umbral de aceptación y la cocina con el suyo", () => {
    const mixed = [
      order({
        id: "aceptada",
        status: "confirmed",
        stageChangedAt: new Date(NOW - 12 * 60_000).toISOString(),
      }),
      order({
        id: "enFuego",
        status: "preparing",
        stageChangedAt: new Date(NOW - 12 * 60_000).toISOString(),
      }),
    ];

    // 12 min: atrasada para la entrada (late 15? no) … con accept 10/15 y prep 15/20 ninguna está
    // *late*, así que se ajustan los umbrales de la entrada para que la distinción sea visible.
    expect(
      filterKitchenOrders(mixed, {
        filter: "all",
        lateOnly: true,
        thresholds: { entry: { warningMinutes: 5, lateMinutes: 10 }, kitchen: { warningMinutes: 15, lateMinutes: 20 } },
        nowMs: NOW,
      }).map((o) => o.id),
    ).toEqual(["aceptada"]);
  });
});
