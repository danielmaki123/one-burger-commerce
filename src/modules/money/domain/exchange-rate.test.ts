import { describe, expect, it } from "vitest";

import {
  assertRateValue,
  closePeriod,
  findActiveRate,
  resolveRateAt,
  type ExchangeRateRecord,
} from "@/modules/money/domain/exchange-rate";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-72`) — **la tasa es un hecho con fecha**.
 *
 * Hoy la tasa es un `Float?` en la fila única de `BusinessSettings`: se pisa, no tiene fecha y no dice
 * contra qué moneda base se registró. La consecuencia medida (`A-72`) es que el reintento de una venta
 * re-suma los cobros guardados con la tasa **vigente** en vez de con la del cobro. Acá la tasa tiene
 * vigencia (`effectiveFrom`/`effectiveTo`), se resuelve **al momento del hecho**, y registrar una nueva
 * **cierra** la anterior en vez de pisarla.
 */
function rate(
  from: string,
  to: string,
  value: number,
  effectiveFrom: string,
  effectiveTo: string | null = null,
): ExchangeRateRecord {
  return {
    id: `${from}-${to}-${effectiveFrom}`,
    fromCurrencyCode: from,
    toCurrencyCode: to,
    rate: value,
    effectiveFrom,
    effectiveTo,
  };
}

describe("resolveRateAt", () => {
  const history: ExchangeRateRecord[] = [
    rate("USD", "NIO", 36.35, "2026-09-01T00:00:00.000Z", "2026-09-15T00:00:00.000Z"),
    rate("USD", "NIO", 36.5, "2026-09-15T00:00:00.000Z", null),
  ];

  it("resuelve la tasa que estaba vigente en el momento del hecho", () => {
    expect(resolveRateAt(history, { from: "USD", to: "NIO", at: "2026-09-10T12:00:00.000Z" })).toBe(36.35);
    expect(resolveRateAt(history, { from: "USD", to: "NIO", at: "2026-09-20T12:00:00.000Z" })).toBe(36.5);
  });

  it("incluye el extremo de arranque del período y excluye el de cierre", () => {
    // Es un intervalo semiabierto: `effectiveFrom` pertenece al período nuevo y `effectiveTo` al siguiente.
    // Sin esa convención, dos períodos se solaparían en el instante exacto del cambio y el mismo cobro
    // podría explicarse con dos tasas distintas.
    expect(resolveRateAt(history, { from: "USD", to: "NIO", at: "2026-09-15T00:00:00.000Z" })).toBe(36.5);
  });

  it("devuelve `null` antes del primer período (no inventa la tasa más vieja)", () => {
    expect(resolveRateAt(history, { from: "USD", to: "NIO", at: "2026-08-01T00:00:00.000Z" })).toBeNull();
  });

  it("devuelve `null` para un par que no tiene historial", () => {
    expect(resolveRateAt(history, { from: "EUR", to: "NIO", at: "2026-09-20T00:00:00.000Z" })).toBeNull();
  });

  it("compara las monedas sin importar el caso", () => {
    expect(resolveRateAt(history, { from: "usd", to: "nio", at: "2026-09-20T00:00:00.000Z" })).toBe(36.5);
  });
});

describe("findActiveRate", () => {
  it("encuentra la tasa vigente (la que no tiene `effectiveTo`)", () => {
    const history = [
      rate("USD", "NIO", 36.35, "2026-09-01T00:00:00.000Z", "2026-09-15T00:00:00.000Z"),
      rate("USD", "NIO", 36.5, "2026-09-15T00:00:00.000Z", null),
    ];

    expect(findActiveRate(history, { from: "USD", to: "NIO" })?.rate).toBe(36.5);
  });

  it("no devuelve una tasa cerrada", () => {
    const history = [rate("USD", "NIO", 36.35, "2026-09-01T00:00:00.000Z", "2026-09-15T00:00:00.000Z")];

    expect(findActiveRate(history, { from: "USD", to: "NIO" })).toBeNull();
  });
});

describe("closePeriod", () => {
  it("cierra la tasa que estaba vigente en el momento de la nueva", () => {
    const previous = rate("USD", "NIO", 36.5, "2026-09-15T00:00:00.000Z", null);

    expect(closePeriod(previous, "2026-09-20T00:00:00.000Z")).toEqual({
      id: previous.id,
      effectiveTo: "2026-09-20T00:00:00.000Z",
    });
  });
});

describe("assertRateValue", () => {
  it("acepta una tasa positiva y finita", () => {
    expect(assertRateValue(36.5)).toBe(36.5);
  });

  it("rechaza cero, negativos y no finitos: una tasa así no es un dato, es un error de tipeo", () => {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => assertRateValue(value)).toThrowError(/tasa/i);
    }
  });
});
