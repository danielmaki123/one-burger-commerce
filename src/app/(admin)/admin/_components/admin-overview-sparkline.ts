import type { OverviewSeriesPoint } from "@/modules/dashboard/domain/admin-overview.types";

export type OverviewSparklineMetric = "value" | "orders" | "ticket";

export type OverviewSparkline = {
  /** `true` solo cuando hay una línea que dibujar (2+ puntos y algo distinto de cero). */
  hasData: boolean;
  points: Array<{ x: number; y: number }>;
  path: string;
};

export const OVERVIEW_SPARKLINE_WIDTH = 100;
export const OVERVIEW_SPARKLINE_HEIGHT = 32;

/**
 * Mini-tendencia de una métrica para las tarjetas de indicadores (referencia del Resumen).
 *
 * La escala arranca en 0 y llega al máximo del período: una sparkline que arranca en el mínimo
 * exagera la variación y en un tablero de operación eso se lee como una mentira. Sin dos puntos
 * (o sin ningún valor), no hay línea: la tarjeta muestra el texto de "sin datos" en su lugar.
 */
export function buildOverviewSparkline(
  series: OverviewSeriesPoint[],
  metric: OverviewSparklineMetric,
): OverviewSparkline {
  const values = series.map((point) => {
    if (metric === "value") return point.completedOrderValue;
    if (metric === "orders") return point.completedOrderCount;
    return point.completedOrderCount === 0
      ? 0
      : point.completedOrderValue / point.completedOrderCount;
  });

  const max = Math.max(0, ...values);

  if (series.length < 2 || max <= 0) {
    return { hasData: false, points: [], path: "" };
  }

  const lastIndex = series.length - 1;
  const points = values.map((value, index) => ({
    x: Math.round((index / lastIndex) * OVERVIEW_SPARKLINE_WIDTH),
    y: Math.round(
      OVERVIEW_SPARKLINE_HEIGHT - (value / max) * OVERVIEW_SPARKLINE_HEIGHT,
    ),
  }));

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return { hasData: true, points, path };
}
