import { describe, expect, it } from "vitest";

import {
  averagePrepMinutes,
  resolveReadyAt,
  resolveStageChangedAt,
} from "./order-stage-times";

/**
 * B5 — los sellos de tiempo del pedido y el promedio de preparación.
 *
 * La regla está en el dominio porque la usan los dos adaptadores (Prisma y memoria): si se copiara, el
 * promedio que ve la cocina y el que fijan los tests podrían no ser el mismo número.
 */
function entry(status: string, createdAt: string) {
  return { id: `${status}-${createdAt}`, orderId: "ord_1", status: status as never, note: null, createdAt };
}

describe("el sello de la etapa actual", () => {
  it("es el último cambio de estado", () => {
    expect(
      resolveStageChangedAt(
        [entry("confirmed", "2026-09-12T18:10:00.000Z"), entry("preparing", "2026-09-12T18:24:00.000Z")],
        "2026-09-12T18:00:00.000Z",
      ),
    ).toBe("2026-09-12T18:24:00.000Z");
  });

  it("sin historial, la etapa empezó al crear el pedido", () => {
    expect(resolveStageChangedAt([], "2026-09-12T18:00:00.000Z")).toBe("2026-09-12T18:00:00.000Z");
  });
});

describe("cuándo quedó listo", () => {
  it("el primer paso a listo, no el último movimiento", () => {
    expect(
      resolveReadyAt([
        entry("preparing", "2026-09-12T18:10:00.000Z"),
        entry("ready_for_pickup", "2026-09-12T18:30:00.000Z"),
        entry("picked_up", "2026-09-12T18:45:00.000Z"),
      ]),
    ).toBe("2026-09-12T18:30:00.000Z");
  });

  it("un pedido que todavía no está listo no tiene sello", () => {
    expect(resolveReadyAt([entry("new", "2026-09-12T18:00:00.000Z")])).toBeNull();
    expect(resolveReadyAt([])).toBeNull();
  });
});

describe("el promedio de preparación", () => {
  function order(createdAt: string, readyAt: string | null) {
    return { createdAt, readyAt };
  }

  it("promedia lo que tardaron los que ya están listos", () => {
    expect(
      averagePrepMinutes([
        order("2026-09-12T18:00:00.000Z", "2026-09-12T18:10:00.000Z"),
        order("2026-09-12T18:00:00.000Z", "2026-09-12T18:20:00.000Z"),
      ]),
    ).toBe(15);
  });

  it("redondea a minutos enteros", () => {
    expect(
      averagePrepMinutes([
        order("2026-09-12T18:00:00.000Z", "2026-09-12T18:07:00.000Z"),
        order("2026-09-12T18:00:00.000Z", "2026-09-12T18:08:00.000Z"),
      ]),
    ).toBe(8);
  });

  it("sin pedidos listos no hay promedio, y eso no es cero", () => {
    expect(averagePrepMinutes([order("2026-09-12T18:00:00.000Z", null)])).toBeNull();
    expect(averagePrepMinutes([])).toBeNull();
  });

  it("un pedido que quedó abierto por error no ensucia el promedio", () => {
    expect(
      averagePrepMinutes([
        order("2026-09-12T18:00:00.000Z", "2026-09-12T18:10:00.000Z"),
        // Seis horas en cocina: es un pedido olvidado, no un dato de la cocina de hoy.
        order("2026-09-12T12:00:00.000Z", "2026-09-12T18:00:00.000Z"),
      ]),
    ).toBe(10);
  });

  it("un sello imposible (listo antes de entrar) se ignora", () => {
    expect(
      averagePrepMinutes([
        order("2026-09-12T18:00:00.000Z", "2026-09-12T18:10:00.000Z"),
        order("2026-09-12T18:00:00.000Z", "2026-09-12T17:00:00.000Z"),
      ]),
    ).toBe(10);
  });
});
