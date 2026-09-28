import { describe, expect, it } from "vitest";

import {
  averagePrepMinutes,
  MAX_PREP_MINUTES,
  resolveLongestPrepMinutes,
  resolveOrderStageTimes,
  resolvePreparingAt,
  resolveReadyAt,
  resolveStageChangedAt,
} from "./order-stage-times";

/**
 * B5 — los sellos de tiempo del pedido y el promedio de preparación.
 *
 * La regla está en el dominio porque la usan los dos adaptadores (Prisma y memoria): si se copiara, el
 * promedio que ve la cocina y el que fijan los tests podrían no ser el mismo número.
 *
 * **Preparación real (corregido por `TASK-ORDERS-KITCHEN-RUNTIME-002`)**: lo que tardó la cocina es
 * `preparingAt → readyAt`, no `createdAt → readyAt`. Un pedido que nadie empezó a preparar **no tiene
 * tiempo de preparación**: contarlo con el reloj de la creación inventa un número que la cocina no hizo.
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

describe("cuándo empezó la preparación", () => {
  it("es el primer paso a preparando: lo que se mide es lo que tardó la cocina", () => {
    expect(
      resolvePreparingAt([
        entry("confirmed", "2026-09-12T18:05:00.000Z"),
        entry("preparing", "2026-09-12T18:12:00.000Z"),
        // Volver a preparando (re-preparación) no reinicia la cuenta: la cocina ya venía trabajando.
        entry("preparing", "2026-09-12T18:40:00.000Z"),
      ]),
    ).toBe("2026-09-12T18:12:00.000Z");
  });

  it("un pedido que nadie empezó a preparar no tiene sello: no se le inventa un inicio", () => {
    expect(resolvePreparingAt([entry("confirmed", "2026-09-12T18:05:00.000Z")])).toBeNull();
    expect(resolvePreparingAt([])).toBeNull();
  });
});

describe("los sellos por etapa, en una sola pasada", () => {
  it("deriva los cinco sellos del historial, aunque venga desordenado", () => {
    expect(
      resolveOrderStageTimes([
        entry("ready_for_pickup", "2026-09-12T18:30:00.000Z"),
        entry("new", "2026-09-12T18:00:00.000Z"),
        entry("picked_up", "2026-09-12T18:45:00.000Z"),
        entry("preparing", "2026-09-12T18:12:00.000Z"),
        entry("confirmed", "2026-09-12T18:05:00.000Z"),
        entry("closed", "2026-09-12T19:00:00.000Z"),
      ]),
    ).toEqual({
      confirmedAt: "2026-09-12T18:05:00.000Z",
      preparingAt: "2026-09-12T18:12:00.000Z",
      readyAt: "2026-09-12T18:30:00.000Z",
      pickedUpAt: "2026-09-12T18:45:00.000Z",
      closedAt: "2026-09-12T19:00:00.000Z",
    });
  });

  it("un pedido que recién entró no tiene ningún sello", () => {
    expect(resolveOrderStageTimes([entry("new", "2026-09-12T18:00:00.000Z")])).toEqual({
      confirmedAt: null,
      preparingAt: null,
      readyAt: null,
      pickedUpAt: null,
      closedAt: null,
    });
  });
});

describe("el promedio de preparación (preparingAt → readyAt)", () => {
  const MINUTE = 60_000;
  const BASE = Date.parse("2026-09-12T18:00:00.000Z");

  function order(input: { createdAt?: string; preparingAt: string | null; readyAt: string | null }) {
    return {
      createdAt: input.createdAt ?? new Date(BASE).toISOString(),
      preparingAt: input.preparingAt,
      readyAt: input.readyAt,
    };
  }

  function at(minutes: number) {
    return new Date(BASE + minutes * MINUTE).toISOString();
  }

  it("promedia lo que tardó la cocina, no lo que esperó el cliente", () => {
    // Los dos entraron a la misma hora y tardaron 10 y 20 minutos **de cocina**; uno esperó 5 minutos
    // aceptado antes de arrancar y el otro 30: eso no es tiempo de preparación.
    expect(
      averagePrepMinutes([
        order({ preparingAt: at(5), readyAt: at(15) }),
        order({ preparingAt: at(30), readyAt: at(50) }),
      ]),
    ).toBe(15);
  });

  it("redondea a minutos enteros", () => {
    expect(
      averagePrepMinutes([
        order({ preparingAt: at(0), readyAt: at(7) }),
        order({ preparingAt: at(0), readyAt: at(8) }),
      ]),
    ).toBe(8);
  });

  it("un pedido listo **sin** sello de preparación no entra: no se le inventa un inicio", () => {
    expect(
      averagePrepMinutes([
        order({ preparingAt: at(0), readyAt: at(10) }),
        // Historial viejo, sin `preparing`: contarlo desde la creación daría 20 y ensuciaría el número.
        order({ preparingAt: null, readyAt: at(20) }),
      ]),
    ).toBe(10);
  });

  it("sin ningún pedido con preparación medida no hay promedio, y eso no es cero", () => {
    expect(averagePrepMinutes([order({ preparingAt: null, readyAt: at(20) })])).toBeNull();
    expect(averagePrepMinutes([order({ preparingAt: at(0), readyAt: null })])).toBeNull();
    expect(averagePrepMinutes([])).toBeNull();
  });

  it("un pedido que quedó abierto por error no ensucia el promedio", () => {
    expect(
      averagePrepMinutes([
        order({ preparingAt: at(0), readyAt: at(10) }),
        // Seis horas de preparación: es un pedido olvidado, no un dato de la cocina de hoy.
        order({ preparingAt: at(0), readyAt: at(MAX_PREP_MINUTES + 120) }),
      ]),
    ).toBe(10);
  });

  it("un sello imposible (listo antes de empezar a preparar) se ignora", () => {
    expect(
      averagePrepMinutes([
        order({ preparingAt: at(0), readyAt: at(10) }),
        order({ preparingAt: at(30), readyAt: at(20) }),
      ]),
    ).toBe(10);
  });
});

describe("la preparación más larga del tablero", () => {
  const MINUTE = 60_000;
  const BASE = Date.parse("2026-09-12T18:00:00.000Z");
  const at = (minutes: number) => new Date(BASE + minutes * MINUTE).toISOString();

  it("es el máximo de las preparaciones reales de los pedidos listos", () => {
    expect(
      resolveLongestPrepMinutes([
        { preparingAt: at(0), readyAt: at(10) },
        { preparingAt: at(0), readyAt: at(24) },
        { preparingAt: at(0), readyAt: at(13) },
      ]),
    ).toBe(24);
  });

  it("sin preparaciones medidas devuelve `null`: la pantalla dice «sin datos», no 0", () => {
    expect(resolveLongestPrepMinutes([])).toBeNull();
    expect(resolveLongestPrepMinutes([{ preparingAt: null, readyAt: at(10) }])).toBeNull();
  });

  it("el pedido olvidado tampoco define el máximo", () => {
    expect(
      resolveLongestPrepMinutes([
        { preparingAt: at(0), readyAt: at(18) },
        { preparingAt: at(0), readyAt: at(MAX_PREP_MINUTES + 60) },
      ]),
    ).toBe(18);
  });
});
