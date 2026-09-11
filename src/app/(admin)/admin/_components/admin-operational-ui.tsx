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
  neutral: "border-border bg-card",
  brand: "border-brand/20 bg-gradient-to-br from-brand to-brand-strong text-brand-foreground shadow-md",
  success: "border-success-strong/25 bg-success",
  warning: "border-warning-strong/25 bg-warning",
  danger: "border-danger-strong/25 bg-danger",
};

const metricIconToneClasses: Record<NonNullable<AdminMetricItem["tone"]>, string> = {
  neutral: "bg-accent text-brand",
  brand: "bg-card/15 text-brand-foreground",
  success: "bg-success-strong/20 text-success-foreground",
  warning: "bg-warning-strong/25 text-warning-foreground",
  danger: "bg-danger-strong/20 text-danger-foreground",
};

const pillToneClasses = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  brand: "border-brand/20 bg-accent text-brand",
  success: "border-success-strong/25 bg-success text-success-foreground",
  warning: "border-warning-strong/25 bg-warning text-warning-foreground",
  danger: "border-danger-strong/25 bg-danger text-danger-foreground",
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
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          {label ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">{label}</p>
          ) : null}
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
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
        const isBrand = tone === "brand";

        return (
          <div
            key={item.label}
            className={`rounded-2xl border p-3.5 ${isBrand ? "shadow-md" : "shadow-sm"} ${metricToneClasses[tone]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider ${
                  isBrand ? "text-brand-foreground/80" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </p>
              {item.icon ? (
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${metricIconToneClasses[tone]}`}>
                  {item.icon}
                </span>
              ) : null}
            </div>
            <p className={`mt-1 text-2xl font-bold ${isBrand ? "text-brand-foreground" : "text-foreground"}`}>
              {item.value}
            </p>
            {item.helper ? (
              <p className={`mt-1 text-xs leading-5 ${isBrand ? "text-brand-foreground/70" : "text-muted-foreground"}`}>
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
      className={`min-w-0 rounded-2xl border border-border bg-card/95 p-3 shadow-sm ${className}`}
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
    <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-center">
      {icon ? (
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-brand">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white before:h-1.5 before:w-1.5 before:rounded-full before:bg-white/90 before:content-[''] ${solidStatusClasses[status]} ${className}`}
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
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${pillToneClasses[tone]} ${className}`}
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
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${pickupTimingClasses[timing.state]} ${className}`}
    >
      {timing.deltaLabel}
    </span>
  );
}
