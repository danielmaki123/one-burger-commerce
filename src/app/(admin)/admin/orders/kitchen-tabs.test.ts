import { describe, expect, it } from "vitest";

import type { OrderStatus } from "@/modules/orders/domain/order.types";

import {
  KITCHEN_DISPATCHED_WINDOW_MINUTES,
  KITCHEN_TABS,
  filterOrdersForKitchenTab,
} from "./kitchen-tabs";

/**
 * Punto 3 del roadmap (2026-09-18) — los tabs del **modo cocina**.
 *
 * Son las cinco preguntas de la cocina, en el orden en que las hace: todo el turno, lo que nadie tomó,
 * lo que está en el fuego, lo que espera en el mostrador y lo último que salió (para el «¿ya salió el
 * de Ana?»). **Sin «Cerradas» y sin «Historial»**: eso es auditoría del turno y vive en el panel.
 *
 * Filtra sobre los pedidos que la pantalla **ya trae** (misma API, mismos datos) y conserva el orden
 * recibido: el tablero y la lista ya vienen ordenados por hora prometida.
 */

const NOW = Date.parse("2026-09-18T20:00:00.000Z");

function order(overrides: {
  id?: string;
  status: OrderStatus;
  stageChangedAt?: string;
  createdAt?: string;
}) {
  return {
    id: overrides.id ?? `ord_${overrides.status}`,
    status: overrides.status,
    stageChangedAt: overrides.stageChangedAt ?? "2026-09-18T19:30:00.000Z",
    createdAt: overrides.createdAt ?? "2026-09-18T19:00:00.000Z",
  };
}

function ids(orders: ReadonlyArray<{ id: string }>): string[] {
  return orders.map((item) => item.id);
}

describe("tabs del modo cocina", () => {
  it("son los cinco de la cocina, sin Cerradas y sin Historial", () => {
    expect(KITCHEN_TABS.map((tab) => tab.label)).toEqual([
      "Todas",
      "Nuevas",
      "Preparando",
      "Listas",
      "Despachadas hace poco",
    ]);
    expect(KITCHEN_TABS.map((tab) => tab.id)).toEqual([
      "all",
      "new",
      "preparing",
      "ready",
      "dispatched",
    ]);
  });

  it("«Todas» muestra el turno tal como llegó", () => {
    const orders = [
      order({ id: "a", status: "new" }),
      order({ id: "b", status: "picked_up" }),
      order({ id: "c", status: "closed" }),
    ];

    expect(ids(filterOrdersForKitchenTab(orders, "all", NOW))).toEqual(["a", "b", "c"]);
  });

  it("«Nuevas» es lo que nadie aceptó todavía", () => {
    const orders = [
      order({ id: "nueva", status: "new" }),
      order({ id: "aceptada", status: "accepted" }),
      order({ id: "cocinando", status: "preparing" }),
    ];

    expect(ids(filterOrdersForKitchenTab(orders, "new", NOW))).toEqual(["nueva"]);
  });

  it("«Preparando» incluye lo aceptado y lo que está en el fuego", () => {
    const orders = [
      order({ id: "nueva", status: "new" }),
      order({ id: "confirmada", status: "confirmed" }),
      order({ id: "aceptada", status: "accepted" }),
      order({ id: "cocinando", status: "preparing" }),
      order({ id: "lista", status: "ready" }),
    ];

    expect(ids(filterOrdersForKitchenTab(orders, "preparing", NOW))).toEqual([
      "confirmada",
      "aceptada",
      "cocinando",
    ]);
  });

  it("«Listas» es lo que espera en el mostrador, sin lo que ya salió", () => {
    const orders = [
      order({ id: "lista", status: "ready" }),
      order({ id: "lista-retiro", status: "ready_for_pickup" }),
      order({ id: "recogida", status: "picked_up" }),
    ];

    expect(ids(filterOrdersForKitchenTab(orders, "ready", NOW))).toEqual([
      "lista",
      "lista-retiro",
    ]);
  });

  it("«Despachadas hace poco» son las que salieron en los últimos 30 minutos del turno", () => {
    const orders = [
      order({
        id: "recien",
        status: "picked_up",
        stageChangedAt: new Date(NOW - 5 * 60_000).toISOString(),
      }),
      order({
        id: "al-limite",
        status: "served",
        stageChangedAt: new Date(
          NOW - KITCHEN_DISPATCHED_WINDOW_MINUTES * 60_000,
        ).toISOString(),
      }),
      order({
        id: "vieja",
        status: "picked_up",
        stageChangedAt: new Date(
          NOW - (KITCHEN_DISPATCHED_WINDOW_MINUTES + 1) * 60_000,
        ).toISOString(),
      }),
      order({ id: "en-el-fuego", status: "preparing" }),
    ];

    expect(ids(filterOrdersForKitchenTab(orders, "dispatched", NOW))).toEqual([
      "recien",
      "al-limite",
    ]);
  });

  it("una etapa con fecha ilegible no aparece como despachada", () => {
    const orders = [
      order({ id: "rara", status: "picked_up", stageChangedAt: "no es una fecha" }),
      order({
        id: "buena",
        status: "picked_up",
        stageChangedAt: new Date(NOW - 60_000).toISOString(),
      }),
    ];

    expect(ids(filterOrdersForKitchenTab(orders, "dispatched", NOW))).toEqual(["buena"]);
  });

  it("«Cerradas» no es un tab de cocina: un id desconocido no filtra nada", () => {
    const orders = [order({ id: "a", status: "new" }), order({ id: "b", status: "closed" })];

    // El modo cocina no ofrece la pregunta, y si llegara por una URL vieja, no deja la pantalla vacía.
    expect(ids(filterOrdersForKitchenTab(orders, "closed", NOW))).toEqual(["a", "b"]);
  });
});
