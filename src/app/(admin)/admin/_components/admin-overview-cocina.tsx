"use client";

import { ArrowRight, Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

import type { TurnoSummary } from "./admin-overview-turno-summary";

/** Las tres etapas del retiro en curso, con los estados del sistema. */
const LANES = [
  {
    key: "pending",
    label: "Por aceptar",
    helper: "Sin confirmar",
    tone: "border-status-pending-border bg-status-pending-bg text-status-pending-text",
    dot: "bg-status-pending-dot",
  },
  {
    key: "prep",
    label: "En preparación",
    helper: "En cocina",
    tone: "border-status-prep-border bg-status-prep-bg text-status-prep-text",
    dot: "bg-status-prep-dot",
  },
  {
    key: "ready",
    label: "Listas",
    helper: "Para retirar",
    tone: "border-status-ready-border bg-status-ready-bg text-status-ready-text",
    dot: "bg-status-ready-dot",
  },
] as const;

function laneCount(summary: TurnoSummary | null, key: (typeof LANES)[number]["key"]) {
  if (!summary) return "…";
  if (key === "pending") return summary.nuevas;
  if (key === "prep") return summary.enPreparacion;
  return summary.listas;
}

/**
 * Estado de cocina del Resumen: los **carriles reales** del flujo de retiro con su contador y la
 * preparación promedio del día.
 *
 * La referencia dibuja tres estaciones de cocina (parrilla, freidoras, empaque) con la cola de cada
 * una: no existen en el backend —no hay modelo, campo ni ruta de estación—, así que se traduce a lo
 * que sí existe y el «tiempo de despacho» es la preparación promedio que mide el servidor.
 */
export function AdminOverviewCocina({
  summary,
  averagePrepMinutes,
}: {
  summary: TurnoSummary | null;
  averagePrepMinutes: number | null;
}) {
  return (
    <section
      aria-labelledby="overview-cocina-title"
      className="min-w-0 rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1 md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="overview-cocina-title" className="font-heading text-st-h3 font-bold text-ink">
            Estado de cocina
          </h3>
          <p className="mt-1 text-st-caption text-ink-secondary">
            Cómo viene el flujo de retiro, etapa por etapa.
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-stitch-md px-3 text-st-body font-semibold text-brand-primary hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          Ir al KDS
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {LANES.map((lane) => (
          <li key={lane.key} className={`rounded-stitch-md border p-3 ${lane.tone}`}>
            <p className="flex items-center gap-2 text-st-overline font-bold uppercase tracking-wider">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${lane.dot}`} />
              {lane.label}
            </p>
            <p className="mt-1 font-mono text-st-h1 font-bold tabular-nums">
              {laneCount(summary, lane.key)}
            </p>
            <p className="text-st-caption">{lane.helper}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-line-subtle pt-2 text-st-body text-ink-secondary">
        Preparación promedio de hoy:{" "}
        <span className="font-mono font-bold tabular-nums text-ink">
          {averagePrepMinutes === null ? "sin datos todavía" : `${averagePrepMinutes} min`}
        </span>
      </p>
    </section>
  );
}

/**
 * Acciones rápidas del Resumen.
 *
 * La referencia trae una foto de stock y un «corte parcial de turno»: la foto es decorativa y el corte
 * X no existe (el cierre de caja es total y solo en efectivo), así que quedan los dos caminos reales.
 */
export function AdminOverviewQuickActions() {
  return (
    <section
      aria-labelledby="overview-actions-title"
      className="min-w-0 rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1 md:p-5"
    >
      <h3 id="overview-actions-title" className="font-heading text-st-h3 font-bold text-ink">
        Acciones rápidas
      </h3>
      <p className="mt-1 text-st-caption text-ink-secondary">
        Lo que se resuelve desde el mostrador.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <Link
          href="/admin/pos"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-stitch-md bg-brand-primary px-4 text-st-body font-bold text-ink-inverse hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nueva orden de mostrador
        </Link>
        <Link
          href="/admin/menu/products"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-stitch-md border border-line-control px-4 text-st-body font-semibold text-ink hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <UtensilsCrossed aria-hidden="true" className="h-4 w-4" />
          Editar el menú
        </Link>
      </div>
    </section>
  );
}
