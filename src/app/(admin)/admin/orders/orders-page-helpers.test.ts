import { describe, expect, it } from "vitest";

import { orderBucket } from "./orders-page-helpers";

/**
 * Fase 4 del checkout (D1) — un pedido puede ser para otro día.
 *
 * La bandeja del turno tiene que separarlo: si un pedido de mañana cae en "Nuevas", la
 * cocina lo empieza hoy. El día se compara con el mismo criterio que usa la vista ("hoy" en
 * la zona de la bandeja).
 */
describe("orderBucket", () => {
  const today = "2026-09-11";

  it("agrupa por estado cuando el pedido es de hoy", () => {
    expect(orderBucket("new", { pickupTime: "2026-09-12T02:00:00.000Z", today })).toBe("nuevas");
    expect(orderBucket("preparing", { pickupTime: "2026-09-12T02:00:00.000Z", today })).toBe(
      "cocina",
    );
    expect(orderBucket("ready_for_pickup", { pickupTime: "2026-09-12T02:00:00.000Z", today })).toBe(
      "listas",
    );
  });

  it("un pedido abierto para otro día va a Programados, no al turno de hoy", () => {
    // 2026-09-13T02:00Z = sábado 12 de septiembre, 8:00 p. m. en Managua.
    expect(orderBucket("new", { pickupTime: "2026-09-13T02:00:00.000Z", today })).toBe(
      "programados",
    );
    expect(orderBucket("confirmed", { pickupTime: "2026-09-19T02:00:00.000Z", today })).toBe(
      "programados",
    );
    // Un pedido de ayer que quedó abierto también sale del turno de hoy.
    expect(orderBucket("preparing", { pickupTime: "2026-09-11T02:00:00.000Z", today })).toBe(
      "programados",
    );
  });

  it("un pedido cerrado se agrupa por estado aunque su retiro fuera de otro día", () => {
    expect(orderBucket("closed", { pickupTime: "2026-09-13T02:00:00.000Z", today })).toBe(
      "cerradas",
    );
    expect(orderBucket("cancelled", { pickupTime: "2026-09-13T02:00:00.000Z", today })).toBe(
      "cerradas",
    );
  });

  it("sin hora de retiro o sin día de referencia se agrupa como antes", () => {
    expect(orderBucket("new")).toBe("nuevas");
    expect(orderBucket("new", { pickupTime: null, today })).toBe("nuevas");
    expect(orderBucket("new", { pickupTime: "no-es-fecha", today })).toBe("nuevas");
    expect(orderBucket("served")).toBe("cerradas");
  });
});
