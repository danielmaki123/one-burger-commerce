import { describe, expect, it } from "vitest";

import {
  formatOverviewCurrency,
  formatOverviewCount,
  formatOverviewDelta,
  formatOverviewInteger,
  formatOverviewPeriodRange,
} from "./admin-overview-formatters";

describe("admin overview formatters", () => {
  it("explica cuando el delta no tiene base de comparación", () => {
    expect(formatOverviewDelta(null)).toBe("Sin base de comparación");
  });

  it("muestra deltas positivos y negativos con signo y formato es-NI", () => {
    expect(formatOverviewDelta(12.5)).toBe(
      "+12.5 % vs. período anterior",
    );
    expect(formatOverviewDelta(-8)).toBe("-8 % vs. período anterior");
  });

  it("formatea moneda NIO y enteros con locale es-NI", () => {
    expect(formatOverviewCurrency(1234.5)).toBe("C$1,234.50");
    expect(formatOverviewInteger(1234)).toBe("1,234");
  });

  it("presenta el rango local exacto en español", () => {
    expect(formatOverviewPeriodRange("2026-07-16", "2026-07-22")).toBe(
      "16 jul 2026 – 22 jul 2026",
    );
  });

  it("pluraliza los conteos visibles del Resumen", () => {
    expect(formatOverviewCount(1, "orden abierta", "órdenes abiertas")).toBe(
      "1 orden abierta",
    );
    expect(formatOverviewCount(2, "orden abierta", "órdenes abiertas")).toBe(
      "2 órdenes abiertas",
    );
    expect(formatOverviewCount(1, "requiere acción", "requieren acción")).toBe(
      "1 requiere acción",
    );
    expect(
      formatOverviewCount(1, "orden completada", "órdenes completadas"),
    ).toBe("1 orden completada");
    expect(
      formatOverviewCount(2, "orden completada", "órdenes completadas"),
    ).toBe("2 órdenes completadas");
  });
});
