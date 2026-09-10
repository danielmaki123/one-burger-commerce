"use client";

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock3,
  PackageSearch,
  ReceiptText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import type {
  AdminOverviewPerformanceResponse,
  OverviewChannel,
  OverviewPerformanceData,
  OverviewPeriod,
} from "@/modules/dashboard/domain/admin-overview.types";
import { Button } from "@/shared/ui/button";

import { AdminEmptyState, AdminPageHeader } from "./admin-operational-ui";
import {
  formatOverviewCurrency,
  formatOverviewCount,
  formatOverviewDelta,
  formatOverviewInteger,
  formatOverviewPeriodRange,
} from "./admin-overview-formatters";
import { isAdminOverviewPerformancePayload } from "./admin-overview-payload";
import { runAdminOverviewRequest } from "./admin-overview-request";
import { AdminOverviewTrendChart } from "./admin-overview-trend-chart";

type PerformanceMetricKey = keyof OverviewPerformanceData["metrics"];

const PERFORMANCE_KPI_DEFINITIONS: Array<{
  metricKey: PerformanceMetricKey;
  title: string;
  format: "currency" | "integer";
  icon: LucideIcon;
  note?: string;
}> = [
  {
    metricKey: "completedOrderValue",
    title: "Valor de órdenes completadas",
    format: "currency",
    icon: Banknote,
    note: "No equivale a pagos liquidados",
  },
  {
    metricKey: "completedOrderCount",
    title: "Órdenes completadas",
    format: "integer",
    icon: CheckCircle2,
  },
  {
    metricKey: "averageTicket",
    title: "Ticket promedio",
    format: "currency",
    icon: ReceiptText,
  },
];

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

// --- Turno de hoy (centro de mando, admin v2) ---
const TZ_MANAGUA = "America/Managua";

function managuaTodayStartIso(): string {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_MANAGUA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `${dateStr}T00:00:00.000-06:00`;
}

type TurnoOrderSummary = { status: string; createdAt: string };

type TurnoState = {
  ventasHoy: number | null;
  ventasDelta: number | null;
  ordenesAbiertas: number | null;
  ordenesNuevas: number | null;
  ordenesTardadas: number | null;
};

const TURNO_OPEN_STATUSES = new Set([
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
]);

const TURNO_LATE_MINUTES = 20;

function OverviewSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="min-h-40 animate-pulse rounded-2xl border border-border bg-card p-4 shadow-sm motion-reduce:animate-none"
    >
      <span className="sr-only">{label}</span>
      <div className="h-4 w-32 rounded bg-secondary" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-xl bg-secondary" />
        <div className="h-24 rounded-xl bg-secondary" />
      </div>
    </div>
  );
}

function ModuleError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-32 flex-col items-start justify-center gap-3 rounded-2xl border border-danger-strong/30 bg-danger p-4 text-sm text-danger-foreground"
    >
      <p>{message}</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

export default function AdminOverviewClient() {
  const [period, setPeriod] = React.useState<OverviewPeriod>("7d");
  const [channel, setChannel] = React.useState<OverviewChannel>("all");
  const [performance, setPerformance] =
    React.useState<AdminOverviewPerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = React.useState(true);
  const [performanceError, setPerformanceError] = React.useState<string | null>(null);
  const [performanceRetryNonce, setPerformanceRetryNonce] = React.useState(0);

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

  // Centro de mando del turno: ventas de hoy + órdenes abiertas, en paralelo y best-effort.
  const [turno, setTurno] = React.useState<TurnoState>({
    ventasHoy: null,
    ventasDelta: null,
    ordenesAbiertas: null,
    ordenesNuevas: null,
    ordenesTardadas: null,
  });

  React.useEffect(() => {
    const controller = new AbortController();

    const loadTurno = async () => {
      try {
        const response = await fetch(
          "/api/admin/overview/performance?period=today&channel=all",
          { cache: "no-store", signal: controller.signal },
        );
        if (response.ok) {
          const payload = (await response.json()) as AdminOverviewPerformanceResponse;
          const metrics = payload.data?.metrics;
          setTurno((prev) => ({
            ...prev,
            ventasHoy: metrics?.completedOrderValue.current ?? 0,
            ventasDelta: metrics?.completedOrderValue.changePercent ?? null,
          }));
        }
      } catch {
        // best-effort: el centro de mando no bloquea el resto del panel
      }

      try {
        const query = new URLSearchParams({ dateFrom: managuaTodayStartIso() });
        const response = await fetch(`/api/admin/orders?${query.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const payload = (await response.json()) as { data?: TurnoOrderSummary[] };
          const nowMs = Date.now();
          const orders = payload.data ?? [];
          const open = orders.filter((order) => TURNO_OPEN_STATUSES.has(order.status));
          setTurno((prev) => ({
            ...prev,
            ordenesAbiertas: open.length,
            ordenesNuevas: orders.filter((order) => order.status === "new").length,
            ordenesTardadas: open.filter(
              (order) =>
                nowMs - new Date(order.createdAt).getTime() >=
                TURNO_LATE_MINUTES * 60000,
            ).length,
          }));
        }
      } catch {
        // best-effort
      }
    };

    void loadTurno();
    return () => controller.abort();
  }, []);

  const attentionItems: Array<{
    key: string;
    href: string;
    icon: LucideIcon;
    title: string;
    detail: string;
  }> = [];
  if ((turno.ordenesNuevas ?? 0) > 0) {
    attentionItems.push({
      key: "nuevas",
      href: "/admin/orders",
      icon: AlertTriangle,
      title: `${turno.ordenesNuevas} orden${turno.ordenesNuevas === 1 ? "" : "es"} nueva${turno.ordenesNuevas === 1 ? "" : "s"} sin confirmar`,
      detail: "La cocina aún no las ve · confirmalas desde Órdenes",
    });
  }
  if ((turno.ordenesTardadas ?? 0) > 0) {
    attentionItems.push({
      key: "tardadas",
      href: "/admin/orders",
      icon: Clock3,
      title: `${turno.ordenesTardadas} orden${turno.ordenesTardadas === 1 ? "" : "es"} lleva${turno.ordenesTardadas === 1 ? "" : "n"} más de ${TURNO_LATE_MINUTES} min en curso`,
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
  const maxProductUnits = Math.max(
    1,
    ...topProducts.map((product) => product.units),
  );

  return (
    <div className="min-w-0 space-y-5 md:space-y-6">
      <AdminPageHeader
        title="Resumen"
        description="Rendimiento de los pedidos para retirar en el período seleccionado."
      />

      <section
        aria-label="Turno de hoy"
        className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      >
        <div className="border-b border-border px-4 py-4 md:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Turno de hoy · ventas
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {turno.ventasHoy === null ? "…" : formatOverviewCurrency(turno.ventasHoy)}
            {turno.ventasDelta !== null ? (
              <span className="ml-2 align-middle text-sm font-semibold text-muted-foreground">
                {formatOverviewDelta(turno.ventasDelta)} vs. ayer
              </span>
            ) : null}
          </p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="px-3 py-3 text-center sm:text-left sm:px-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Órdenes activas</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
              {turno.ordenesAbiertas === null ? "…" : turno.ordenesAbiertas}
            </p>
          </div>
          <div className="px-3 py-3 text-center sm:text-left sm:px-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nuevas</p>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
              {turno.ordenesNuevas === null ? "…" : turno.ordenesNuevas}
            </p>
          </div>
        </div>

        <div className="px-4 py-3 md:px-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Necesita atención · {attentionItems.length}
          </p>
          {attentionItems.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Todo en orden: nada requiere atención inmediata.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {attentionItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex min-h-14 items-center gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger text-danger-foreground">
                        <ItemIcon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section
        aria-label="Filtros de rendimiento"
        className="min-w-0 rounded-xl border border-border bg-muted/40 p-2 sm:p-3"
      >
        <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-3">
          <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Período
            </p>
            <div
              role="group"
              aria-label="Período de rendimiento"
              className="grid min-w-0 grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1"
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={period === option.value}
                  onClick={() => setPeriod(option.value)}
                  className={[
                    "inline-flex min-h-11 min-w-0 w-full items-center justify-center whitespace-nowrap rounded-lg px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 motion-reduce:transition-none sm:px-2 sm:text-xs",
                    period === option.value
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-brand-strong",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Canal
            </p>
            <div
              role="group"
              aria-label="Canal de rendimiento"
              className="grid min-w-0 grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1"
            >
              {CHANNEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={channel === option.value}
                  onClick={() => setChannel(option.value)}
                  className={[
                    "inline-flex min-h-11 min-w-0 w-full items-center justify-center whitespace-nowrap rounded-lg px-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 motion-reduce:transition-none sm:px-2 sm:text-xs",
                    channel === option.value
                      ? "bg-brand text-brand-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-brand-strong",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="overview-performance-title" className="min-w-0">
        <h2 id="overview-performance-title" className="sr-only">Rendimiento</h2>
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
              <div className="mb-3">
                <h3
                  id="overview-kpi-title"
                  className="font-heading text-lg font-bold text-foreground"
                >
                  Indicadores del período
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comparación contra el período inmediatamente anterior.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {PERFORMANCE_KPI_DEFINITIONS.map((definition) => {
                  const metric = performanceData.metrics[definition.metricKey];
                  const MetricIcon = definition.icon;

                  return (
                    <article
                      key={definition.metricKey}
                      className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-semibold leading-5 text-muted-foreground">
                          {definition.title}
                        </h4>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-brand">
                          <MetricIcon
                            aria-hidden="true"
                            className="h-5 w-5"
                            strokeWidth={2}
                          />
                        </span>
                      </div>
                      <p className="mt-3 break-all text-2xl font-bold tabular-nums text-foreground">
                        {definition.format === "currency"
                          ? formatOverviewCurrency(metric.current)
                          : formatOverviewInteger(metric.current)}
                      </p>
                      <p className="mt-2 text-sm font-medium leading-5 text-foreground">
                        {formatOverviewDelta(metric.changePercent)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Período: {performancePeriodRange}
                      </p>
                      {definition.note ? (
                        <p className="mt-2 border-t border-border pt-2 text-xs font-medium leading-5 text-muted-foreground">
                          {definition.note}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <AdminOverviewTrendChart
              series={performanceData.series}
              completedOrderValue={
                performanceData.metrics.completedOrderValue.current
              }
              completedOrderCount={
                performanceData.metrics.completedOrderCount.current
              }
              periodLabel={performancePeriodRange}
            />


              <section
                aria-labelledby="overview-products-title"
                className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5"
              >
                <div>
                  <h3
                    id="overview-products-title"
                    className="font-heading text-lg font-bold text-foreground"
                  >
                    Productos más vendidos
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Top 5 por unidades en órdenes completadas.
                  </p>
                </div>

                {topProducts.length > 0 ? (
                  <ol
                    aria-label="Top 5 de productos por unidades completadas"
                    className="mt-4 space-y-3"
                  >
                    {topProducts.map((product, index) => (
                      <li
                        key={product.productId}
                        className="min-w-0 rounded-xl border border-border bg-background p-3"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <p className="min-w-0 break-words text-sm font-semibold text-foreground">
                            <span className="mr-2 text-muted-foreground">
                              {index + 1}.
                            </span>
                            {product.productName}
                          </p>
                          <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                            {formatOverviewInteger(product.units)} unid.
                          </p>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${product.productName}: ${formatOverviewCount(product.units, "unidad", "unidades")}`}
                          aria-valuemin={0}
                          aria-valuemax={maxProductUnits}
                          aria-valuenow={product.units}
                          className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
                        >
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{
                              width: `${(product.units / maxProductUnits) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          Valor completado:{" "}
                          <span className="break-all font-semibold tabular-nums text-foreground">
                            {formatOverviewCurrency(
                              product.completedOrderValue,
                            )}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mt-4">
                    <AdminEmptyState
                      title="Sin productos completados"
                      description="Todavía no existen órdenes completadas con productos en el período seleccionado."
                      icon={
                        <PackageSearch
                          className="h-5 w-5"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      }
                    />
                  </div>
                )}
              </section>
            <p role="status" className="sr-only">
              Datos de rendimiento cargados.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
