import { describe, expect, it } from "vitest";

import type { OverviewSeriesPoint } from "@/modules/dashboard/domain/admin-overview.types";

import {
  buildOverviewChartLabels,
  buildOverviewChartModel,
} from "./admin-overview-chart";

function point(
  key: string,
  completedOrderValue: number,
  completedOrderCount: number,
): OverviewSeriesPoint {
  return {
    key,
    label: key,
    completedOrderValue,
    completedOrderCount,
  };
}

describe("buildOverviewChartModel", () => {
  it("expone un marcador visible para un único bucket con órdenes", () => {
    const model = buildOverviewChartModel([point("Día único", 125, 3)]);

    expect(model.points).toHaveLength(1);
    expect(model.points[0]?.lineY).toBeLessThan(model.baselineY);
    expect(model.points[0]?.markerRadius).toBeGreaterThan(0);
    expect(model.linePath).toMatch(/^M /);
  });

  it("mantiene una línea base válida cuando todos los valores son cero", () => {
    const model = buildOverviewChartModel([
      point("Día 1", 0, 0),
      point("Día 2", 0, 0),
    ]);

    expect(Number.isFinite(model.baselineY)).toBe(true);
    expect(model.points.every((item) => item.barHeight === 0)).toBe(true);
    expect(model.points.every((item) => item.lineY === model.baselineY)).toBe(
      true,
    );
    expect(model.linePath).not.toMatch(/NaN|Infinity/);
  });

  it("calcula escalas independientes para valor y cantidad", () => {
    const model = buildOverviewChartModel([
      point("Día 1", 100, 1),
      point("Día 2", 50, 10),
    ]);

    expect(model.maxValue).toBe(100);
    expect(model.maxCount).toBe(10);
    expect(model.points[0]!.barY).toBeLessThan(model.points[1]!.barY);
    expect(model.points[0]!.lineY).toBeGreaterThan(model.points[1]!.lineY);
  });

  it("reduce las etiquetas de 30 días conservando la primera y la última", () => {
    const series = Array.from({ length: 30 }, (_, index) =>
      point(`Día ${index + 1}`, index, index),
    );
    const model = buildOverviewChartModel(series);
    const visibleLabels = model.points.filter((item) => item.showLabel);

    expect(visibleLabels.length).toBeLessThanOrEqual(7);
    expect(visibleLabels[0]?.key).toBe("Día 1");
    expect(visibleLabels.at(-1)?.key).toBe("Día 30");
  });
});

describe("buildOverviewChartLabels", () => {
  it.each([
    { bucketCount: 2, expectedLabelCount: 2 },
    { bucketCount: 7, expectedLabelCount: 7 },
    { bucketCount: 24, expectedLabelCount: 7 },
    { bucketCount: 30, expectedLabelCount: 7 },
  ])(
    "posiciona $expectedLabelCount labels desde las X reales de $bucketCount buckets",
    ({ bucketCount, expectedLabelCount }) => {
      const model = buildOverviewChartModel(
        Array.from({ length: bucketCount }, (_, index) =>
          point(`Día ${index + 1}`, index, index),
        ),
      );
      const labels = buildOverviewChartLabels(model);
      const visiblePoints = model.points.filter((item) => item.showLabel);

      expect(labels).toHaveLength(expectedLabelCount);
      expect(visiblePoints).toHaveLength(expectedLabelCount);
      labels.forEach((label, index) => {
        const visiblePoint = visiblePoints[index]!;
        const expectedTranslate =
          index === 0 ? 0 : index === visiblePoints.length - 1 ? -100 : -50;

        expect(label.key).toBe(visiblePoint.key);
        expect(label.leftPercent).toBe(
          (visiblePoint.x / model.width) * 100,
        );
        expect(label.translatePercent).toBe(expectedTranslate);
      });
      expect(
        labels.every(
          (label) => label.leftPercent >= 0 && label.leftPercent <= 100,
        ),
      ).toBe(true);
    },
  );
});
