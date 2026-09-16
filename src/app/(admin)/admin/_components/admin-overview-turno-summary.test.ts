import { describe, expect, it } from "vitest";

import { summarizeTurno } from "./admin-overview-turno-summary";

const NOW = Date.parse("2026-09-16T18:00:00.000Z");

function order(status: string, minutesAgo: number) {
  return {
    status,
    createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  };
}

describe("summarizeTurno", () => {
  it("sin órdenes deja todo en cero", () => {
    expect(summarizeTurno([], NOW)).toEqual({
      abiertas: 0,
      nuevas: 0,
      enPreparacion: 0,
      listas: 0,
      tardadas: 0,
    });
  });

  it("reparte las órdenes abiertas en los tres carriles del flujo de retiro", () => {
    const resumen = summarizeTurno(
      [
        order("new", 5),
        order("preparing", 6),
        order("ready_for_pickup", 2),
        order("delivered", 30),
        order("cancelled", 40),
      ],
      NOW,
    );

    expect(resumen.abiertas).toBe(3);
    expect(resumen.nuevas).toBe(1);
    expect(resumen.enPreparacion).toBe(1);
    expect(resumen.listas).toBe(1);
  });

  it("cuenta como tardada la orden que pasó el umbral de su carril", () => {
    // Los umbrales son los del KDS (`comanda-helpers`): 15 min para «por aceptar» y 20 para cocina.
    const resumen = summarizeTurno(
      [order("new", 16), order("preparing", 21), order("ready", 19), order("preparing", 19)],
      NOW,
    );

    expect(resumen.tardadas).toBe(2);
  });

  it("una fecha ilegible no inventa un atraso", () => {
    const resumen = summarizeTurno(
      [{ status: "preparing", createdAt: "no-es-una-fecha" }],
      NOW,
    );

    expect(resumen.enPreparacion).toBe(1);
    expect(resumen.tardadas).toBe(0);
  });
});
