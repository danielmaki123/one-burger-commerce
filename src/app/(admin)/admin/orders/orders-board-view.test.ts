import { describe, expect, it } from "vitest";

import type { OrderStatus } from "@/modules/orders/domain/order.types";

import { filterOrdersForKitchenTab } from "./kitchen-tabs";
import { filterOrdersForBoardView, type BoardViewOrder } from "./orders-board-view";

/**
 * Punto 3 del roadmap (2026-09-18) — qué ve el **tablero** según el modo.
 *
 * La regla del modo cocina vive acá y no dentro de la página para no hacer crecer su rama de
 * clasificación (que ya es deuda congelada) y para poder probarla sin montar la pantalla entera.
 */

const NOW = Date.parse("2026-09-18T20:00:00.000Z");

function order(
  id: string,
  status: OrderStatus,
  stageChangedAt = "2026-09-18T19:30:00.000Z",
): BoardViewOrder {
  return { id, status, stageChangedAt };
}

describe("filtro del tablero", () => {
  it("sin modo cocina devuelve el trabajo del turno tal como llegó", () => {
    const working = [order("a", "new"), order("b", "preparing")];

    expect(filterOrdersForBoardView(working, { kitchenMode: false, kitchenTab: "new" })).toEqual(
      working,
    );
  });

  it("en modo cocina aplica el tab elegido", () => {
    const working = [order("a", "new"), order("b", "preparing")];

    expect(
      filterOrdersForBoardView(working, { kitchenMode: true, kitchenTab: "preparing" }).map(
        (item) => item.id,
      ),
    ).toEqual(["b"]);
  });

  it("«Despachadas hace poco» trae lo que ya salió del local", () => {
    const working = [
      order("nueva", "new"),
      order("salio", "picked_up", new Date(NOW - 2 * 60_000).toISOString()),
      order("vieja", "picked_up", new Date(NOW - 90 * 60_000).toISOString()),
    ];

    expect(
      filterOrdersForBoardView(working, {
        kitchenMode: true,
        kitchenTab: "dispatched",
        nowMs: NOW,
      }).map((item) => item.id),
    ).toEqual(["salio"]);
  });

  it("un tab desconocido en modo cocina no vacía el tablero", () => {
    const working = [order("a", "new"), order("b", "preparing")];

    expect(
      filterOrdersForBoardView(working, { kitchenMode: true, kitchenTab: "closed" }).map(
        (item) => item.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("delega en las mismas reglas de los tabs de cocina, sin reimplementarlas", () => {
    const working = [order("a", "new"), order("b", "ready"), order("c", "picked_up")];

    for (const tab of ["all", "new", "preparing", "ready", "dispatched"] as const) {
      expect(
        filterOrdersForBoardView(working, { kitchenMode: true, kitchenTab: tab, nowMs: NOW }).map(
          (item) => item.id,
        ),
      ).toEqual(filterOrdersForKitchenTab(working, tab, NOW).map((item) => item.id));
    }
  });
});
