"use client";

import type { LucideIcon } from "lucide-react";

import type { OverviewSeriesPoint } from "@/modules/dashboard/domain/admin-overview.types";

import {
  buildOverviewSparkline,
  OVERVIEW_SPARKLINE_HEIGHT,
  OVERVIEW_SPARKLINE_WIDTH,
  type OverviewSparklineMetric,
} from "./admin-overview-sparkline";

type AdminOverviewMetricCardProps = {
  title: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  /** Ámbar para identidad/cocina, sky para administración: las tres tarjetas del Resumen son sky. */
  tone: "amber" | "sky";
  delta: string;
  periodLabel: string;
  series: OverviewSeriesPoint[];
  metric: OverviewSparklineMetric;
  note?: string;
};

/**
 * Tarjeta de indicador del período (referencia §4): título, cifra en mono con su unidad, comparación
 * contra el período anterior, mini-tendencia y el pie con el rango medido.
 *
 * La mini-tendencia es decorativa en el sentido de que el dato exacto vive en la tabla del gráfico:
 * va `aria-hidden` y nunca reemplaza al número.
 */
export function AdminOverviewMetricCard({
  title,
  value,
  unit,
  icon: MetricIcon,
  tone,
  delta,
  periodLabel,
  series,
  metric,
  note,
}: AdminOverviewMetricCardProps) {
  const sparkline = buildOverviewSparkline(series, metric);
  const isAmber = tone === "amber";

  return (
    <article className="relative min-w-0 overflow-hidden rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-2xl ${
          isAmber ? "bg-brand-amber/10" : "bg-brand-primary/10"
        }`}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* `min-h-11` para que las tres tarjetas alineen la cifra aunque un título ocupe dos líneas. */}
        <h3 className="min-h-11 text-st-h3 font-semibold text-ink">{title}</h3>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md ${
            isAmber
              ? "bg-brand-amber-soft text-brand-amber"
              : "bg-brand-primary-muted text-brand-primary"
          }`}
        >
          <MetricIcon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>

      <p className="relative mt-2 flex flex-wrap items-baseline gap-2">
        <span className="break-all font-mono text-st-display font-bold tabular-nums text-ink">
          {value}
        </span>
        <span className="text-st-caption font-bold uppercase tracking-wider text-ink-muted">
          {unit}
        </span>
      </p>

      <p className="relative mt-2 w-fit rounded-stitch-sm bg-surface-elevated px-2 py-0.5 text-st-caption font-semibold text-ink-secondary">
        {delta}
      </p>

      <div className="relative mt-2">
        {sparkline.hasData ? (
          <svg
            viewBox={`0 0 ${OVERVIEW_SPARKLINE_WIDTH} ${OVERVIEW_SPARKLINE_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className={`block h-8 w-full ${isAmber ? "text-brand-amber" : "text-brand-primary"}`}
          >
            <path
              d={sparkline.path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : (
          <p className="text-st-caption text-ink-muted">
            Todavía no hay dos puntos para dibujar la tendencia.
          </p>
        )}
      </div>

      <div className="relative mt-2 rounded-stitch-sm bg-surface-low/80 p-2.5">
        <p className="text-st-caption text-ink-secondary">
          Período: <span className="font-mono tabular-nums">{periodLabel}</span>
        </p>
        {note ? (
          <p className="mt-1 text-st-caption font-medium text-ink-muted">{note}</p>
        ) : null}
      </div>
    </article>
  );
}
