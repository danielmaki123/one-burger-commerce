"use client";

import { BellRing, Flame, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { formatOverviewDelta } from "./admin-overview-formatters";
import { TURNO_THRESHOLDS, type TurnoSummary } from "./admin-overview-turno-summary";
import { AdminMetricStrip } from "./admin-operational-ui";
import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";

export type TurnoAttentionItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  /** «Por aceptar» (ámbar) o atraso de SLA (rojo). El color nunca va solo: la fila lleva texto. */
  tone: "pending" | "sla";
};

type AdminOverviewTurnoProps = {
  ventasHoy: number | null;
  ventasDelta: number | null;
  summary: TurnoSummary | null;
  loading: boolean;
  currencyCode: string;
  attention: TurnoAttentionItem[];
};

/**
 * Hero del turno del Resumen (referencia §2): la plata del día, el estado de la operación y las tres
 * mini-tarjetas de carriles, arriba de todo.
 *
 * El punto del estado es **estático** salvo cuando hay algo atrasado: un latido permanente en una
 * pantalla que mira el encargado todo el día cansa la vista y deja de significar urgencia.
 */
export function AdminOverviewTurno({
  ventasHoy,
  ventasDelta,
  summary,
  loading,
  currencyCode,
  attention,
}: AdminOverviewTurnoProps) {
  const tardadas = summary?.tardadas ?? 0;
  const currencyFormat = useCurrencyFormat();

  return (
    <section
      aria-label="Turno de hoy"
      className="relative min-w-0 overflow-hidden rounded-stitch-xl border border-line-subtle bg-gradient-to-br from-surface-elevated via-surface-card to-surface-low p-4 shadow-elevation-2 md:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-amber/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-brand-primary/10 blur-3xl"
      />

      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-stitch-sm bg-brand-amber-soft px-2 py-0.5 text-st-overline font-bold uppercase tracking-wider text-brand-amber">
              Turno de hoy · Ventas
            </span>
            <span className="text-st-caption text-ink-muted">En curso</span>
          </div>

          <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-st-display font-bold tabular-nums text-ink">
              {ventasHoy === null ? "…" : formatCurrency(ventasHoy, currencyFormat)}
            </span>
            <span className="text-st-caption font-bold uppercase tracking-wider text-ink-muted">
              {currencyCode}
            </span>
            {ventasDelta !== null ? (
              <span className="text-st-caption font-semibold text-ink-secondary">
                {formatOverviewDelta(ventasDelta)} vs. ayer
              </span>
            ) : null}
          </p>

          <p className="mt-3 flex items-center gap-2.5 border-t border-line-subtle pt-2 text-st-body text-ink">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                attention.length > 0
                  ? "bg-status-sla-dot motion-safe:animate-pulse"
                  : "bg-status-ready-dot"
              }`}
            />
            {attention.length === 0
              ? "Todo en orden: nada requiere atención inmediata."
              : `${attention.length} ${attention.length === 1 ? "frente necesita" : "frentes necesitan"} atención ahora mismo.`}
          </p>
        </div>

        <AdminMetricStrip
          className="w-full lg:w-auto"
          columnsClassName="grid-cols-3"
          items={[
            {
              label: "Activas",
              value: loading || !summary ? "…" : summary.abiertas,
              helper: "En cocina y listas",
              icon: <Flame aria-hidden="true" className="h-4 w-4" strokeWidth={2} />,
            },
            {
              label: "Nuevas",
              value: loading || !summary ? "…" : summary.nuevas,
              helper: "Por confirmar",
              tone: "warning",
              icon: <BellRing aria-hidden="true" className="h-4 w-4" strokeWidth={2} />,
            },
            {
              label: "Atención",
              value: loading || !summary ? "…" : tardadas,
              helper: `SLA < ${TURNO_THRESHOLDS.kitchen.lateMinutes} min`,
              tone: tardadas > 0 ? "danger" : "neutral",
              icon: <ShieldCheck aria-hidden="true" className="h-4 w-4" strokeWidth={2} />,
            },
          ]}
        />
      </div>

      <div className="relative z-10 mt-4 border-t border-line-subtle pt-3">
        <h3 className="text-st-overline font-bold uppercase tracking-wider text-ink-muted">
          Necesita atención · {attention.length}
        </h3>

        {attention.length === 0 ? (
          <p className="mt-1 text-st-body text-ink-secondary">
            Nada pendiente: la cocina viene al día.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-line-subtle">
            {attention.map((item) => {
              const ItemIcon = item.icon;

              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex min-h-14 items-center gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-stitch-md ${
                        item.tone === "sla"
                          ? "bg-status-sla-bg text-status-sla-text"
                          : "bg-status-pending-bg text-status-pending-text"
                      }`}
                    >
                      <ItemIcon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-st-body font-semibold text-ink">
                        {item.title}
                      </span>
                      <span className="block truncate text-st-caption text-ink-secondary">
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
