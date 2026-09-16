"use client";

import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

import type {
  AdminOverviewPerformanceResponse,
  OverviewChannel,
  OverviewPerformanceData,
  OverviewPeriod,
} from "@/modules/dashboard/domain/admin-overview.types";
import { dateInTimeZone, pickupInstant } from "@/modules/business-settings/domain/pickup-days";
import { useBusinessSettings, useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";
import { Button } from "@/shared/ui/button";
import { TabsList, TabsTrigger } from "@/shared/ui/tabs";

import { AdminPageHeader } from "./admin-operational-ui";
import {
  AdminOverviewCocina,
  AdminOverviewQuickActions,
} from "./admin-overview-cocina";
import { AdminOverviewMetricCard } from "./admin-overview-metric-card";
import { AdminOverviewTopProducts } from "./admin-overview-top-products";
import { AdminOverviewTrendChart } from "./admin-overview-trend-chart";
import {
  AdminOverviewTurno,
  type TurnoAttentionItem,
} from "./admin-overview-turno";
import {
  summarizeTurno,
  TURNO_THRESHOLDS,
  type TurnoOrderSummary,
  type TurnoSummary,
} from "./admin-overview-turno-summary";
import {
  formatOverviewDelta,
  formatOverviewInteger,
  formatOverviewPeriodRange,
} from "./admin-overview-formatters";
import { isAdminOverviewPerformancePayload } from "./admin-overview-payload";
import { runAdminOverviewRequest } from "./admin-overview-request";
import type { OverviewSparklineMetric } from "./admin-overview-sparkline";

type PerformanceMetricKey = keyof OverviewPerformanceData["metrics"];

const PERFORMANCE_KPI_DEFINITIONS: Array<{
  metricKey: PerformanceMetricKey;
  title: string;
  format: "currency" | "integer";
  /** Qué unidad acompaña a la cifra: la del negocio, pedidos o el promedio por orden. */
  unit: "business-currency" | "orders" | "ticket";
  sparkline: OverviewSparklineMetric;
  tone: "amber" | "sky";
  icon: LucideIcon;
  note?: string;
}> = [
  {
    metricKey: "completedOrderValue",
    title: "Valor de órdenes completadas",
    format: "currency",
    unit: "business-currency",
    sparkline: "value",
    tone: "amber",
    icon: Banknote,
    note: "No equivale a pagos liquidados",
  },
  {
    metricKey: "completedOrderCount",
    title: "Órdenes completadas",
    format: "integer",
    unit: "orders",
    sparkline: "orders",
    tone: "sky",
    icon: CheckCircle2,
  },
  {
    metricKey: "averageTicket",
    title: "Ticket promedio",
    format: "currency",
    unit: "ticket",
    sparkline: "ticket",
    tone: "sky",
    icon: ReceiptText,
  },
];

const UNIT_LABELS: Record<(typeof PERFORMANCE_KPI_DEFINITIONS)[number]["unit"], string> = {
  "business-currency": "",
  orders: "pedidos",
  ticket: "prom / orden",
};

const PERIOD_OPTIONS: Array<{ value: OverviewPeriod; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "month", label: "Este mes" },
];

// El MVP es solo retiro: el canal queda fijo y no se ofrece delivery.
const CHANNEL_OPTIONS: Array<{ value: OverviewChannel; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pickup", label: "Retiro" },
];

export function businessTodayStartIso(timeZone: string): string {
  const today = dateInTimeZone(new Date(), timeZone);
  const start = pickupInstant({ date: today, time: "00:00", timeZone });

  return start?.toISOString() ?? "";
}

function OverviewSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="min-h-40 animate-pulse rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1 motion-reduce:animate-none"
    >
      <span className="sr-only">{label}</span>
      <div className="h-4 w-32 rounded-stitch-xs bg-surface-elevated" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-stitch-md bg-surface-elevated" />
        <div className="h-24 rounded-stitch-md bg-surface-elevated" />
      </div>
    </div>
  );
}

function ModuleError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-start justify-center gap-3 rounded-stitch-lg border border-status-sla-border bg-status-sla-bg p-4 text-st-body text-status-sla-text"
    >
      <p>{message}</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

type TurnoState = {
  summary: TurnoSummary | null;
  ventasHoy: number | null;
  ventasDelta: number | null;
  averagePrepMinutes: number | null;
};

const EMPTY_TURNO: TurnoState = {
  summary: null,
  ventasHoy: null,
  ventasDelta: null,
  averagePrepMinutes: null,
};

/**
 * Resumen operativo (`/admin`).
 *
 * Junta tres lecturas que el backend ya expone por separado: el rendimiento del período elegido
 * (`/api/admin/overview/performance`), el turno de hoy (misma ruta con `period=today` + el listado de
 * órdenes) y los carriles de cocina derivados de ese listado. Las tres son best-effort: si una falla,
 * el resto del panel sigue en pie.
 */
export default function AdminOverviewClient() {
  const { timezone, currencyCode } = useBusinessSettings();
  const currencyFormat = useCurrencyFormat();

  const [period, setPeriod] = React.useState<OverviewPeriod>("7d");
  const [channel, setChannel] = React.useState<OverviewChannel>("all");
  const [performance, setPerformance] =
    React.useState<AdminOverviewPerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = React.useState(true);
  const [performanceError, setPerformanceError] = React.useState<string | null>(null);
  const [performanceRetryNonce, setPerformanceRetryNonce] = React.useState(0);
  const [turno, setTurno] = React.useState<TurnoState>(EMPTY_TURNO);
  const [turnoLoading, setTurnoLoading] = React.useState(true);

  const loadPerformance = React.useCallback(
    async (
      nextPeriod: OverviewPeriod,
      nextChannel: OverviewChannel,
      signal: AbortSignal,
    ) => {
      setPerformanceLoading(true);
      setPerformanceError(null);

      const query = new URLSearchParams({
        period: nextPeriod,
        channel: nextChannel,
      });

      await runAdminOverviewRequest<AdminOverviewPerformanceResponse>({
        signal,
        request: (requestSignal) =>
          fetch(`/api/admin/overview/performance?${query.toString()}`, {
            cache: "no-store",
            signal: requestSignal,
          }),
        isPayload: isAdminOverviewPerformancePayload,
        onData: (payload) => {
          setPerformance(payload);
          setPerformanceLoading(false);
        },
        onError: () => {
          setPerformance(null);
          setPerformanceError("No se pudo cargar el rendimiento del período seleccionado.");
          setPerformanceLoading(false);
        },
        onRedirect: (href) => window.location.assign(href),
      });
    },
    [],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void loadPerformance(period, channel, controller.signal);
    return () => controller.abort();
  }, [channel, loadPerformance, performanceRetryNonce, period]);

  // Turno de hoy: ventas del día y carriles de cocina, en paralelo y best-effort. Se recalcula con
  // «Actualizar» (mismo nonce que el rendimiento) para que un botón refresque toda la pantalla.
  React.useEffect(() => {
    const controller = new AbortController();

    const loadTurno = async () => {
      setTurnoLoading(true);
      const partial: TurnoState = { ...EMPTY_TURNO };

      try {
        const response = await fetch(
          "/api/admin/overview/performance?period=today&channel=all",
          { cache: "no-store", signal: controller.signal },
        );
        if (response.ok) {
          const payload = (await response.json()) as AdminOverviewPerformanceResponse;
          const metrics = payload.data?.metrics;
          partial.ventasHoy = metrics?.completedOrderValue.current ?? 0;
          partial.ventasDelta = metrics?.completedOrderValue.changePercent ?? null;
        }
      } catch {
        // best-effort: el centro de mando no bloquea el resto del panel
      }

      try {
        const query = new URLSearchParams({ dateFrom: businessTodayStartIso(timezone) });
        const response = await fetch(`/api/admin/orders?${query.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const payload = (await response.json()) as {
            data?: TurnoOrderSummary[];
            meta?: { averagePrepMinutes?: number | null };
          };
          partial.summary = summarizeTurno(payload.data ?? [], Date.now());
          partial.averagePrepMinutes = payload.meta?.averagePrepMinutes ?? null;
        }
      } catch {
        // best-effort
      }

      setTurno(partial);
      setTurnoLoading(false);
    };

    void loadTurno();
    return () => controller.abort();
  }, [performanceRetryNonce, timezone]);

  const attentionItems: TurnoAttentionItem[] = [];
  const nuevas = turno.summary?.nuevas ?? 0;
  const tardadas = turno.summary?.tardadas ?? 0;

  if (nuevas > 0) {
    attentionItems.push({
      key: "nuevas",
      href: "/admin/orders",
      icon: AlertTriangle,
      tone: "pending",
      title: `${nuevas} orden${nuevas === 1 ? "" : "es"} nueva${nuevas === 1 ? "" : "s"} sin confirmar`,
      detail: "La cocina aún no las ve · confirmalas desde Órdenes",
    });
  }

  if (tardadas > 0) {
    attentionItems.push({
      key: "tardadas",
      href: "/admin/orders",
      icon: Clock3,
      tone: "sla",
      title: `${tardadas} orden${tardadas === 1 ? "" : "es"} pasó los ${TURNO_THRESHOLDS.kitchen.lateMinutes} min en curso`,
      detail: "Revisá qué las está atrasando",
    });
  }

  const performanceData = performance?.data;
  const performancePeriodRange = performance
    ? formatOverviewPeriodRange(
        performance.meta.ranges.current.localStartDate,
        performance.meta.ranges.current.localEndDate,
      )
    : null;
  const topProducts = performanceData?.topProducts.slice(0, 5) ?? [];

  return (
    <div className="min-w-0 space-y-5 md:space-y-6">
      <AdminPageHeader
        label="Operación · Métricas en vivo"
        title="Resumen"
        description="Rendimiento de los pedidos para retirar en el período seleccionado."
        actions={
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => setPerformanceRetryNonce((nonce) => nonce + 1)}
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Actualizar
          </Button>
        }
      />

      <AdminOverviewTurno
        ventasHoy={turno.ventasHoy}
        ventasDelta={turno.ventasDelta}
        summary={turno.summary}
        loading={turnoLoading}
        currencyCode={currencyCode}
        attention={attentionItems}
      />

      <section
        aria-label="Filtros de rendimiento"
        className="min-w-0 rounded-stitch-lg border border-line-subtle bg-surface-low p-2 sm:p-3"
      >
        <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-3">
          <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
            <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Período
            </p>
            <TabsList ariaLabel="Período de rendimiento" className="min-w-0">
              {PERIOD_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  activeValue={period}
                  onClick={(value) => setPeriod(value as OverviewPeriod)}
                  disabled={performanceLoading}
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
            <p className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
              Canal
            </p>
            <TabsList ariaLabel="Canal de rendimiento" className="min-w-0">
              {CHANNEL_OPTIONS.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  activeValue={channel}
                  onClick={(value) => setChannel(value as OverviewChannel)}
                  disabled={performanceLoading}
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-performance-title" className="min-w-0">
        <h2 id="overview-performance-title" className="sr-only">
          Rendimiento
        </h2>
        {performanceLoading ? <OverviewSkeleton label="Cargando rendimiento" /> : null}
        {!performanceLoading && performanceError ? (
          <ModuleError
            message={performanceError}
            onRetry={() => setPerformanceRetryNonce((nonce) => nonce + 1)}
          />
        ) : null}
        {!performanceLoading &&
        !performanceError &&
        performanceData &&
        performancePeriodRange ? (
          <div className="space-y-5 md:space-y-6">
            <section aria-labelledby="overview-kpi-title">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3
                    id="overview-kpi-title"
                    className="font-heading text-st-h2 font-bold text-ink"
                  >
                    Indicadores del período
                  </h3>
                  <p className="mt-1 text-st-body text-ink-secondary">
                    Comparación contra el período inmediatamente anterior.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-stitch-sm bg-surface-low px-2.5 py-1 text-st-caption font-semibold text-ink-secondary">
                  <CalendarDays aria-hidden="true" className="h-4 w-4 text-brand-amber" />
                  <span className="font-mono tabular-nums">{performancePeriodRange}</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {PERFORMANCE_KPI_DEFINITIONS.map((definition) => {
                  const metric = performanceData.metrics[definition.metricKey];

                  return (
                    <AdminOverviewMetricCard
                      key={definition.metricKey}
                      title={definition.title}
                      unit={
                        definition.unit === "business-currency"
                          ? currencyCode
                          : UNIT_LABELS[definition.unit]
                      }
                      value={
                        definition.format === "currency"
                          ? formatCurrency(metric.current, currencyFormat)
                          : formatOverviewInteger(metric.current)
                      }
                      icon={definition.icon}
                      tone={definition.tone}
                      metric={definition.sparkline}
                      delta={formatOverviewDelta(metric.changePercent)}
                      periodLabel={performancePeriodRange}
                      series={performanceData.series}
                      note={definition.note}
                    />
                  );
                })}
              </div>
            </section>

            <AdminOverviewTrendChart
              series={performanceData.series}
              completedOrderValue={performanceData.metrics.completedOrderValue.current}
              completedOrderCount={performanceData.metrics.completedOrderCount.current}
              periodLabel={performancePeriodRange}
            />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <AdminOverviewCocina
                summary={turno.summary}
                averagePrepMinutes={turno.averagePrepMinutes}
              />
              <AdminOverviewQuickActions />
            </div>

            <AdminOverviewTopProducts products={topProducts} />

            <p role="status" className="sr-only">
              Datos de rendimiento cargados.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
