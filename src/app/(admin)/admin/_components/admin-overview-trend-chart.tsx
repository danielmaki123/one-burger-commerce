"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

import type { OverviewSeriesPoint } from "@/modules/dashboard/domain/admin-overview.types";

import {
  buildOverviewChartLabels,
  buildOverviewChartModel,
} from "./admin-overview-chart";
import {
  formatOverviewCount,
  formatOverviewCurrency,
  formatOverviewInteger,
} from "./admin-overview-formatters";

type AdminOverviewTrendChartProps = {
  series: OverviewSeriesPoint[];
  completedOrderValue: number;
  completedOrderCount: number;
  periodLabel: string;
};

export function AdminOverviewTrendChart({
  series,
  completedOrderValue,
  completedOrderCount,
  periodLabel,
}: AdminOverviewTrendChartProps) {
  const model = buildOverviewChartModel(series);
  const chartLabels = buildOverviewChartLabels(model);
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <section
      aria-labelledby="overview-trend-heading"
      className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            id="overview-trend-heading"
            className="font-heading text-lg font-bold text-foreground"
          >
            Tendencia de órdenes completadas
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <ul
          aria-label="Leyenda del gráfico"
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-foreground"
        >
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-4 rounded-sm bg-chart-1"
            />
            Barras: valor completado
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-0 w-5 border-t-2 border-chart-2"
            />
            Línea: órdenes completadas
          </li>
        </ul>
      </div>

      <p className="mt-4 rounded-xl bg-secondary/60 px-3 py-2 text-sm leading-6 text-foreground">
        {completedOrderCount === 0 && completedOrderValue === 0
          ? "No se registraron órdenes completadas en este período."
          : `${formatOverviewCount(completedOrderCount, "orden completada", "órdenes completadas")} por ${formatOverviewCurrency(completedOrderValue)}.`}
      </p>

      <div className="mt-4 min-w-0">
        <svg
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          viewBox={`0 0 ${model.width} ${model.height}`}
          preserveAspectRatio="none"
          className="block h-48 w-full overflow-hidden text-muted-foreground sm:h-56"
        >
          <title id={titleId}>Valor y cantidad de órdenes completadas</title>
          <desc id={descriptionId}>
            Las barras muestran el valor completado y la línea muestra la cantidad
            de órdenes. Ambas series usan escalas independientes. Los datos exactos
            están disponibles en la tabla siguiente.
          </desc>

          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = 20 + (model.baselineY - 20) * fraction;
            return (
              <line
                key={fraction}
                x1="28"
                x2={model.width - 28}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {model.points.map((point) => (
            <rect
              key={`bar-${point.key}`}
              x={point.barX}
              y={point.barY}
              width={point.barWidth}
              height={point.barHeight}
              rx="2"
              className="fill-chart-1"
            />
          ))}

          {model.linePath ? (
            <path
              d={model.linePath}
              fill="none"
              className="stroke-chart-2"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {model.points.map((point) => (
            <circle
              key={`marker-${point.key}`}
              cx={point.x}
              cy={point.lineY}
              r={point.markerRadius}
              className="fill-card stroke-chart-2"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {chartLabels.length > 0 ? (
          <div
            aria-label="Etiquetas del gráfico"
            className="relative mt-1 h-5 min-w-0 text-xs font-medium text-muted-foreground"
          >
            {chartLabels.map((label) => (
              <span
                key={`label-${label.key}`}
                className="absolute top-0 whitespace-nowrap"
                style={{
                  left: `${label.leftPercent}%`,
                  transform: `translateX(${label.translatePercent}%)`,
                }}
              >
                {label.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <details className="group mt-4 border-t border-border pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 text-sm font-semibold text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          Ver datos del gráfico
          <ChevronDown
            aria-hidden="true"
            className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            strokeWidth={2}
          />
        </summary>
        <div className="mt-2 min-w-0 rounded-xl border border-border">
          <table className="w-full table-fixed border-collapse text-left text-xs tabular-nums sm:text-sm [&_td]:break-words [&_td]:px-2 [&_td]:py-2 [&_th]:break-words [&_th]:bg-secondary/60 [&_th]:px-2 [&_th]:py-2 [&_th]:font-semibold">
            <caption className="sr-only">
              Datos exactos de valor y órdenes completadas por período
            </caption>
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[36%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border text-foreground">
                <th scope="col">Período</th>
                <th scope="col">Valor</th>
                <th scope="col">Órdenes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {series.map((point) => (
                <tr key={point.key}>
                  <td>{point.label}</td>
                  <td className="break-all">
                    {formatOverviewCurrency(point.completedOrderValue)}
                  </td>
                  <td className="break-all">
                    {formatOverviewInteger(point.completedOrderCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
