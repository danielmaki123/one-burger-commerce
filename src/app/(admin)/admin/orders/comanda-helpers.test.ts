import { describe, expect, it } from "vitest";

import {
  COMANDA_LANES,
  comandaCounters,
  comandaLane,
  formatStageElapsed,
  groupComandasByLane,
  resolveComandaUrgency,
} from "./comanda-helpers";

/**
 * B3 — el tablero de comandas: en qué carril va cada pedido y cuánto hace que está ahí.
 *
 * El reloj es **el tiempo en la etapa actual** (decisión del owner): un pedido aceptado hace 20
 * minutos y en preparación hace 2 no está atrasado. Los umbrales (10 y 15 min) entran por parámetro
 * porque en B5 salen de la configuración de cada local; acá viven los valores por defecto.
 */
const NOW = Date.parse("2026-09-11T20:10:00.000Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

describe("carriles del tablero", () => {
  it("cada etapa de cocina tiene su carril, y lo que ya terminó no va a ninguno", () => {
    expect(comandaLane("new")).toBe("pending");
    expect(comandaLane("confirmed")).toBe("preparing");
    expect(comandaLane("accepted")).toBe("preparing");
    expect(comandaLane("preparing")).toBe("preparing");
    expect(comandaLane("ready_for_pickup")).toBe("ready");
    expect(comandaLane("ready")).toBe("ready");
  });

  it("un pedido cerrado, entregado o cancelado no está en el tablero", () => {
    expect(comandaLane("picked_up")).toBeNull();
    expect(comandaLane("closed")).toBeNull();
    expect(comandaLane("cancelled")).toBeNull();
    expect(comandaLane("delivered")).toBeNull();
  });

  it("los tres carriles existen siempre, aunque estén vacíos", () => {
    const grouped = groupComandasByLane([]);

    expect(COMANDA_LANES.map((lane) => lane.id)).toEqual(["pending", "preparing", "ready"]);
    expect(grouped.pending).toEqual([]);
    expect(grouped.preparing).toEqual([]);
    expect(grouped.ready).toEqual([]);
  });

  it("agrupa sin perder ni duplicar pedidos, y en el orden en que vienen", () => {
    const grouped = groupComandasByLane([
      { id: "a", status: "new" as const },
      { id: "b", status: "preparing" as const },
      { id: "c", status: "new" as const },
      { id: "d", status: "closed" as const },
      { id: "e", status: "ready_for_pickup" as const },
    ]);

    expect(grouped.pending.map((order) => order.id)).toEqual(["a", "c"]);
    expect(grouped.preparing.map((order) => order.id)).toEqual(["b"]);
    expect(grouped.ready.map((order) => order.id)).toEqual(["e"]);
  });

  it("los contadores de la barra salen de la misma agrupación", () => {
    expect(
      comandaCounters([
        { status: "new" as const },
        { status: "new" as const },
        { status: "confirmed" as const },
        { status: "preparing" as const },
        { status: "ready_for_pickup" as const },
        { status: "closed" as const },
      ]),
    ).toEqual({ pending: 2, preparing: 2, ready: 1, total: 5 });
  });
});

describe("cuánto hace que está en la etapa", () => {
  it("los primeros minutos se leen en minutos", () => {
    expect(formatStageElapsed(0)).toBe("recién");
    expect(formatStageElapsed(1)).toBe("hace 1 min");
    expect(formatStageElapsed(12)).toBe("hace 12 min");
    expect(formatStageElapsed(59)).toBe("hace 59 min");
  });

  it("pasada la hora se resume en horas y minutos", () => {
    expect(formatStageElapsed(60)).toBe("hace 1 h");
    expect(formatStageElapsed(65)).toBe("hace 1 h 5 min");
    expect(formatStageElapsed(140)).toBe("hace 2 h 20 min");
  });

  it("un reloj que va para atrás no muestra tiempos negativos", () => {
    expect(formatStageElapsed(-3)).toBe("recién");
  });
});

describe("urgencia de una comanda", () => {
  function urgency(minutes: number, overrides: { warningMinutes?: number; lateMinutes?: number } = {}) {
    return resolveComandaUrgency({
      stageChangedAt: minutesAgo(minutes),
      nowMs: NOW,
      ...overrides,
    });
  }

  it("menos de 10 minutos es una comanda normal", () => {
    expect(urgency(6)).toEqual({ level: "normal", minutes: 6, label: "hace 6 min" });
  });

  it("de 10 a 15 minutos avisa que se está demorando", () => {
    expect(urgency(10)).toMatchObject({ level: "warning", label: "hace 10 min" });
    expect(urgency(14)).toMatchObject({ level: "warning", label: "hace 14 min" });
  });

  it("a los 15 minutos está atrasada y lo dice con todas las letras", () => {
    expect(urgency(15)).toEqual({ level: "late", minutes: 15, label: "Atrasado hace 15 min" });
    expect(urgency(17)).toMatchObject({ level: "late", label: "Atrasado hace 17 min" });
  });

  it("pasada la hora, el atraso se lee igual de claro", () => {
    expect(urgency(80).label).toBe("Atrasado hace 1 h 20 min");
  });

  it("los umbrales se pueden configurar (B5) sin tocar la pantalla", () => {
    expect(urgency(8, { warningMinutes: 5, lateMinutes: 7 })).toMatchObject({ level: "late" });
    expect(urgency(6, { warningMinutes: 5, lateMinutes: 7 })).toMatchObject({ level: "warning" });
    expect(urgency(4, { warningMinutes: 5, lateMinutes: 7 })).toMatchObject({ level: "normal" });
  });

  it("una fecha ilegible no inventa un atraso", () => {
    const result = resolveComandaUrgency({ stageChangedAt: "no es una fecha", nowMs: NOW });

    expect(result.level).toBe("normal");
    expect(result.minutes).toBe(0);
  });
});
