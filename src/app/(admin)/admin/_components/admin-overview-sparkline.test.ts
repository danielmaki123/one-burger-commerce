import { describe, expect, it } from "vitest";

import type { OverviewSeriesPoint } from "@/modules/dashboard/domain/admin-overview.types";

import { buildOverviewSparkline } from "./admin-overview-sparkline";

function point(
  key: string,
  completedOrderValue: number,
  completedOrderCount: number,
): OverviewSeriesPoint {
  return { key, label: key, completedOrderValue, completedOrderCount };
}

describe("buildOverviewSparkline", () => {
  it("no dibuja nada sin serie suficiente para una línea", () => {
    expect(buildOverviewSparkline([], "value").hasData).toBe(false);
    expect(buildOverviewSparkline([point("a", 100, 2)], "value").hasData).toBe(false);
  });

  it("no dibuja nada cuando el período no tiene datos", () => {
    const serie = [point("a", 0, 0), point("b", 0, 0), point("c", 0, 0)];

    expect(buildOverviewSparkline(serie, "value").hasData).toBe(false);
    expect(buildOverviewSparkline(serie, "orders").hasData).toBe(false);
    expect(buildOverviewSparkline(serie, "ticket").hasData).toBe(false);
  });

  it("escala de 0 al máximo y arranca abajo", () => {
    const serie = [point("a", 0, 0), point("b", 50, 1), point("c", 100, 2)];
    const sparkline = buildOverviewSparkline(serie, "value");

    expect(sparkline.hasData).toBe(true);
    // Tres puntos, repartidos de borde a borde.
    expect(sparkline.points.map((p) => p.x)).toEqual([0, 50, 100]);
    // El 0 toca la base y el máximo toca el techo (con el aire del padding).
    expect(sparkline.points[0]?.y).toBe(32);
    expect(sparkline.points[2]?.y).toBe(0);
    expect(sparkline.path.startsWith("M 0 32")).toBe(true);
  });

  it("la tendencia de ticket promedio divide valor entre órdenes", () => {
    const serie = [point("a", 1000, 4), point("b", 900, 3)];
    const ticket = buildOverviewSparkline(serie, "ticket");
    const ordenes = buildOverviewSparkline(serie, "orders");

    // 250 y 300: el segundo punto es el más alto, así que queda más arriba.
    expect(ticket.hasData).toBe(true);
    expect(ticket.points[0]!.y).toBeGreaterThan(ticket.points[1]!.y);
    expect(ticket.points).toHaveLength(ordenes.points.length);
  });

  it("un período sin órdenes no rompe el ticket promedio", () => {
    const serie = [point("a", 0, 0), point("b", 500, 2)];

    expect(buildOverviewSparkline(serie, "ticket").hasData).toBe(true);
  });
});
