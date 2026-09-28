import { describe, expect, it } from "vitest";

import {
  COMANDA_LANES,
  comandaCounters,
  groupComandasByLane,
  KITCHEN_BOARD_STATUSES,
  resolveOrderLane,
} from "./order-lanes";
import type { OrderStatus } from "./order.types";

/**
 * A-64 — el mapa estado→carril, **una sola vez**.
 *
 * La regla vivía cinco veces (`comandaLane`, `orderBucket`, `getAdminOrderSolidStatus`, `ORDER_JOURNEY`,
 * `DISPATCHED_STATUSES`) y dos de esas copias ponían `confirmed` en preparación. Estos tests fijan la
 * regla **canónica** de la spec de Cocina: aceptado todavía no es «en el fuego».
 */

const ALL_STATUSES: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "accepted",
  "served",
  "closed",
  "cancelled",
];

describe("order-lanes · el carril canónico de cada estado", () => {
  it("`confirmed` está en ENTRADA: aceptado no es estar en el fuego", () => {
    // El defecto que esta TASK corrige (`comanda-helpers.ts:42` lo ponía en preparación).
    expect(resolveOrderLane("confirmed")).toBe("entry");
  });

  it("`new` y `accepted` (equivalente de mesa) también están en ENTRADA", () => {
    expect(resolveOrderLane("new")).toBe("entry");
    expect(resolveOrderLane("accepted")).toBe("entry");
  });

  it("`preparing` está en PREPARANDO y es lo único que está ahí", () => {
    expect(resolveOrderLane("preparing")).toBe("preparing");
  });

  it("`ready` y `ready_for_pickup` están en LISTOS", () => {
    expect(resolveOrderLane("ready")).toBe("ready");
    expect(resolveOrderLane("ready_for_pickup")).toBe("ready");
  });

  it("un pedido que ya salió del local no está en el tablero", () => {
    for (const status of ["picked_up", "closed", "delivered", "served", "cancelled"] as const) {
      expect(resolveOrderLane(status), status).toBeNull();
    }
  });

  it("ningún estado del esquema queda sin carril ni en dos a la vez", () => {
    // La red de la regla: los doce estados del esquema están clasificados, y la lista de los que
    // tienen carril es exactamente la que el tablero dibuja.
    const conCarril = ALL_STATUSES.filter((status) => resolveOrderLane(status) !== null);

    expect(new Set(conCarril).size).toBe(conCarril.length);
    expect([...conCarril].sort()).toEqual([...KITCHEN_BOARD_STATUSES].sort());
  });
});

describe("order-lanes · los carriles del tablero", () => {
  it("son tres, en el orden en que la cocina los mira, con su copy de vacío", () => {
    expect(COMANDA_LANES.map((lane) => lane.id)).toEqual(["entry", "preparing", "ready"]);
    expect(COMANDA_LANES.map((lane) => lane.label)).toEqual(["Entrada", "Preparando", "Listos"]);
    for (const lane of COMANDA_LANES) {
      expect(lane.empty.trim().length, lane.id).toBeGreaterThan(0);
    }
  });
});

describe("order-lanes · reparto y contadores", () => {
  it("reparte conservando el orden recibido y sin inventar carriles", () => {
    const grouped = groupComandasByLane([
      { id: "a", status: "new" },
      { id: "b", status: "preparing" },
      { id: "c", status: "confirmed" },
      { id: "d", status: "closed" },
      { id: "e", status: "ready_for_pickup" },
    ]);

    expect(grouped.entry.map((order) => order.id)).toEqual(["a", "c"]);
    expect(grouped.preparing.map((order) => order.id)).toEqual(["b"]);
    expect(grouped.ready.map((order) => order.id)).toEqual(["e"]);
  });

  it("los contadores cuentan sólo lo que está en el tablero", () => {
    expect(
      comandaCounters([
        { status: "new" },
        { status: "confirmed" },
        { status: "preparing" },
        { status: "ready_for_pickup" },
        { status: "closed" },
        { status: "cancelled" },
      ]),
    ).toEqual({ entry: 2, preparing: 1, ready: 1, total: 4 });
  });

  it("un tablero vacío cuenta cero en los tres carriles", () => {
    expect(comandaCounters([])).toEqual({ entry: 0, preparing: 0, ready: 0, total: 0 });
  });
});
