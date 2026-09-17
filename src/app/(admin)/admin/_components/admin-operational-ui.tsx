"use client";

import type { ReactNode } from "react";

import type { AdminPickupTiming } from "./admin-pickup-timing";

type AdminMetricItem = {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  icon?: ReactNode;
};

const metricToneClasses: Record<NonNullable<AdminMetricItem["tone"]>, string> = {
  neutral: "border-line-subtle bg-surface-card",
  brand: "border-transparent bg-brand-primary",
  success: "border-status-ready-border bg-status-ready-bg",
  warning: "border-status-pending-border bg-status-pending-bg",
  danger: "border-status-sla-border bg-status-sla-bg",
};

const metricLabelToneClasses: Record<NonNullable<AdminMetricItem["tone"]>, string> = {
  neutral: "text-ink-secondary",
  brand: "text-ink-inverse/80",
  success: "text-status-ready-text",
  warning: "text-status-pending-text",
  danger: "text-status-sla-text",
};

const metricValueToneClasses: Record<NonNullable<AdminMetricItem["tone"]>, string> = {
  neutral: "text-ink",
  brand: "text-ink-inverse",
  success: "text-status-ready-text",
  warning: "text-status-pending-text",
  danger: "text-status-sla-text",
};

const metricHelperToneClasses: Record<NonNullable<AdminMetricItem["tone"]>, string> = {
  neutral: "text-ink-secondary",
  brand: "text-ink-inverse/80",
  success: "text-status-ready-text",
  warning: "text-status-pending-text",
  danger: "text-status-sla-text",
};

const metricIconToneClasses: Record<NonNullable<AdminMetricItem["tone"]>, string> = {
  neutral: "bg-surface-elevated text-brand-primary",
  brand: "bg-canvas/15 text-ink-inverse",
  success: "bg-status-ready-dot/25 text-status-ready-text",
  warning: "bg-status-pending-dot/25 text-status-pending-text",
  danger: "bg-status-sla-pulse/25 text-status-sla-text",
};

const pillToneClasses = {
  neutral: "border-line-subtle bg-surface-low text-ink",
  brand: "border-brand/20 bg-surface-elevated text-brand",
  success: "border-status-ready-border bg-status-ready-bg text-status-ready-text",
  warning: "border-status-pending-border bg-status-pending-bg text-status-pending-text",
  danger: "border-status-sla-border bg-status-sla-bg text-danger-foreground",
};

type AdminPageHeaderProps = {
  label?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function AdminPageHeader({
  label,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <section className="rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {label ? (
            <p className="text-st-overline font-bold uppercase tracking-wider text-brand-amber">{label}</p>
          ) : null}
          <h1 className="font-heading text-st-h1 font-bold tracking-tight text-ink">
            {title}
          </h1>
          {/* La descripción se recorta a dos líneas en celular: la regla del 20% de cabecera deja el
              alto para la operación, y el texto completo sigue en el DOM para el lector de pantalla. */}
          <p className="max-w-2xl text-st-body leading-6 text-ink-secondary line-clamp-2 sm:line-clamp-none">
            {description}
          </p>
        </div>
        {/* Las acciones ocupan el ancho en celular: con `shrink-0` el bloque conservaba su ancho
            máximo y una fila de tres acciones se salía de la pantalla a 375 px en lugar de envolver. */}
        {actions ? <div className="w-full shrink-0 sm:w-auto">{actions}</div> : null}
      </div>
    </section>
  );
}

type AdminMetricStripProps = {
  items: AdminMetricItem[];
  className?: string;
  columnsClassName?: string;
};

export function AdminMetricStrip({
  items,
  className = "",
  columnsClassName = "grid-cols-2 lg:grid-cols-4",
}: AdminMetricStripProps) {
  return (
    <section className={`grid gap-3 ${columnsClassName} ${className}`}>
      {items.map((item) => {
        const tone = item.tone ?? "neutral";

        return (
          <div
            key={item.label}
            className={`min-w-0 rounded-stitch-lg border p-3 shadow-elevation-1 sm:p-3.5 ${metricToneClasses[tone]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className={`min-w-0 text-st-overline font-bold uppercase tracking-wider ${metricLabelToneClasses[tone]}`}
              >
                {item.label}
              </p>
              {item.icon ? (
                // En móvil el ícono es decorativo y se va: el número y su etiqueta tienen que entrar en
                // una columna de un tercio sin empujar la tarjeta fuera de la pantalla.
                <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-stitch-sm sm:flex ${metricIconToneClasses[tone]}`}>
                  {item.icon}
                </span>
              ) : null}
            </div>
            <p className={`mt-1 font-mono text-st-h1 font-bold tabular-nums ${metricValueToneClasses[tone]}`}>
              {item.value}
            </p>
            {item.helper ? (
              <p className={`mt-1 text-st-caption leading-5 ${metricHelperToneClasses[tone]}`}>
                {item.helper}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

type AdminCompactToolbarProps = {
  children: ReactNode;
  className?: string;
};

export function AdminCompactToolbar({
  children,
  className = "",
}: AdminCompactToolbarProps) {
  return (
    <section
      className={`min-w-0 rounded-stitch-lg border border-line-subtle bg-surface-card/95 p-3 shadow-elevation-1 ${className}`}
    >
      {children}
    </section>
  );
}

type AdminEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export function AdminEmptyState({
  title,
  description,
  action,
  icon,
}: AdminEmptyStateProps) {
  return (
    <div className="rounded-stitch-lg border border-dashed border-line-subtle bg-surface-low/40 p-8 text-center">
      {icon ? (
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-elevated text-brand">
          {icon}
        </span>
      ) : null}
      <p className="text-st-body font-semibold text-ink">{title}</p>
      <p className="mt-1 text-st-body text-ink-secondary">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

type AdminStatusSolidKey = "nueva" | "preparando" | "lista" | "cerrada" | "alerta";

// Mapeo único del estado de orden al vocabulario sólido del salón (admin v2).
export function getAdminOrderSolidStatus(status: string): AdminStatusSolidKey {
  if (status === "new") return "nueva";
  if (
    status === "confirmed" ||
    status === "accepted" ||
    status === "preparing" ||
    status === "out_for_delivery"
  ) {
    return "preparando";
  }
  if (status === "ready" || status === "ready_for_pickup") return "lista";
  if (status === "cancelled") return "alerta";
  return "cerrada";
}

// Mapeo único del estado de reserva al vocabulario sólido del salón (admin v2).
export function getAdminReservationSolidStatus(status: string): AdminStatusSolidKey {
  if (status === "requested") return "nueva";
  if (status === "approved") return "lista";
  if (status === "seated") return "preparando";
  if (status === "rejected" || status === "no_show") return "alerta";
  return "cerrada";
}

// "hace N min" / "hace H h MM" para tickets del turno.
export function formatAdminElapsed(createdAt: string, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest}`;
}

const solidStatusClasses: Record<AdminStatusSolidKey, string> = {
  nueva: "bg-status-nueva",
  preparando: "bg-status-preparando",
  lista: "bg-status-lista",
  cerrada: "bg-status-cerrada",
  alerta: "bg-status-alerta",
};

export function AdminStatusSolid({
  children,
  status,
  className = "",
}: {
  children: ReactNode;
  status: AdminStatusSolidKey;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-st-caption font-bold uppercase tracking-wide text-white before:h-1.5 before:w-1.5 before:rounded-full before:bg-white/90 before:content-[''] ${solidStatusClasses[status]} ${className}`}
    >
      {children}
    </span>
  );
}

type AdminStatusPillProps = {
  children: ReactNode;
  tone?: keyof typeof pillToneClasses;
  className?: string;
};

export function AdminStatusPill({
  children,
  tone = "neutral",
  className = "",
}: AdminStatusPillProps) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-st-caption font-semibold ${pillToneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const pickupTimingClasses: Record<"on-time" | "past" | "late", string> = {
  "on-time": "bg-pickup-on-time/12 text-pickup-on-time",
  past: "bg-pickup-past/15 text-pickup-past",
  late: "bg-pickup-late/15 text-pickup-late",
};

/**
 * Cuánto falta (o cuánto se pasó) respecto de la hora de retiro prometida.
 *
 * Verde dentro del tiempo, naranja pasado, rojo muy tardado. Los colores son tokens
 * propios (`--pickup-*`) y no los del estado del pedido: un pedido puede estar "listo"
 * y aun así ir tarde contra la hora que le prometimos al cliente.
 */
export function AdminPickupTimingChip({
  timing,
  className = "",
}: {
  timing: AdminPickupTiming;
  className?: string;
}) {
  if (timing.state === "done" || timing.state === "unknown") return null;

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-st-caption font-bold tabular-nums ${pickupTimingClasses[timing.state]} ${className}`}
    >
      {timing.deltaLabel}
    </span>
  );
}
