import type { OverviewSeriesPoint } from "@/modules/dashboard/domain/admin-overview.types";

export type OverviewChartPoint = OverviewSeriesPoint & {
  x: number;
  barX: number;
  barY: number;
  barHeight: number;
  barWidth: number;
  lineY: number;
  markerRadius: number;
  showLabel: boolean;
};

export type OverviewChartModel = {
  width: number;
  height: number;
  baselineY: number;
  maxValue: number;
  maxCount: number;
  points: OverviewChartPoint[];
  linePath: string;
};

export type OverviewChartLabel = Pick<OverviewChartPoint, "key" | "label"> & {
  leftPercent: number;
  translatePercent: -100 | -50 | 0;
};

export function buildOverviewChartModel(
  series: OverviewSeriesPoint[],
): OverviewChartModel {
  const width = 720;
  const height = 240;
  const padding = { top: 20, right: 28, bottom: 8, left: 28 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + plotHeight;
  const maxValue = Math.max(
    0,
    ...series.map((item) => item.completedOrderValue),
  );
  const maxCount = Math.max(
    0,
    ...series.map((item) => item.completedOrderCount),
  );
  const slotWidth = plotWidth / Math.max(series.length, 1);
  const barWidth = Math.max(2, Math.min(24, slotWidth * 0.56));
  const maximumVisibleLabels = 7;
  const visibleLabelIndexes = new Set<number>();

  if (series.length <= maximumVisibleLabels) {
    series.forEach((_, index) => visibleLabelIndexes.add(index));
  } else {
    for (let index = 0; index < maximumVisibleLabels; index += 1) {
      visibleLabelIndexes.add(
        Math.round((index * (series.length - 1)) / (maximumVisibleLabels - 1)),
      );
    }
  }

  const points = series.map((item, index) => {
    const x = padding.left + slotWidth * (index + 0.5);
    const valueRatio = maxValue === 0 ? 0 : item.completedOrderValue / maxValue;
    const countRatio = maxCount === 0 ? 0 : item.completedOrderCount / maxCount;
    const barHeight = plotHeight * valueRatio;

    return {
      ...item,
      x,
      barX: x - barWidth / 2,
      barY: baselineY - barHeight,
      barHeight,
      barWidth,
      lineY: baselineY - plotHeight * countRatio,
      markerRadius: 4,
      showLabel: visibleLabelIndexes.has(index),
    };
  });
  const linePath = points
    .map((item, index) => `${index === 0 ? "M" : "L"} ${item.x} ${item.lineY}`)
    .join(" ");

  return {
    width,
    height,
    baselineY,
    maxValue,
    maxCount,
    points,
    linePath,
  };
}

export function buildOverviewChartLabels(
  model: OverviewChartModel,
): OverviewChartLabel[] {
  const visiblePoints = model.points.filter((point) => point.showLabel);

  return visiblePoints.map((point, index) => ({
    key: point.key,
    label: point.label,
    leftPercent: (point.x / model.width) * 100,
    translatePercent:
      visiblePoints.length === 1
        ? -50
        : index === 0
          ? 0
          : index === visiblePoints.length - 1
            ? -100
            : -50,
  }));
}
