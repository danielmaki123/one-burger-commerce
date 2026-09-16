"use client";

import Link from "next/link";
import { AlarmClock, Clock, MessageSquareText } from "lucide-react";

import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import type { OrderStatus, OrderType } from "@/modules/orders/domain/order.types";

import { describeAdminPickup } from "../_components/admin-pickup-timing";
import { OrderActions } from "./order-actions";
import { resolveComandaUrgency } from "./comanda-helpers";
import { orderTypePresentation } from "./orders-page-helpers";

export type ComandaItem = {
  id: string;
  productName: string;
  quantity: number;
  notes?: string | null;
  modifiers: Array<{ id: string; name: string }>;
};

/**
 * Lo que la comanda necesita del pedido: nada de totales ni de PIN.
 *
 * Es un tipo propio a propósito: si la comanda recibiera el registro completo, nada impediría que
 * alguien empiece a mostrar precios en la cocina (§4.2).
 */
export type ComandaOrder = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName: string;
  createdAt: string;
  /** Cuándo empezó la etapa actual (B3a): es lo que mide la urgencia. */
  stageChangedAt: string;
  items: ComandaItem[];
  pickupTime?: string | null;
  pickupScheduled?: boolean;
  /** Sucursal del pedido: con una sola no aporta, con varias es lo primero que se pregunta. */
  locationName?: string | null;
};

type OrderComandaCardProps = {
  order: ComandaOrder;
  nowMs: number;
  timeZone: string;
  onUpdateStatus: (status: OrderStatus, note?: string | null) => Promise<void>;
  /** Umbrales del local (B5); sin ellos rigen los valores por defecto. */
  warningMinutes?: number;
  lateMinutes?: number;
  /** Recién llegada: se resalta un momento para que el ojo la encuentre (§4.4). */
  isNew?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** Muestra la sucursal en la comanda; el tablero lo pide solo cuando el usuario ve más de una. */
  showLocation?: boolean;
};

/**
 * La tarjeta de comanda del KDS, con el sistema Stitch (`design-system.md` §6.2 y §7).
 *
 * Tres decisiones que salieron de traducir la referencia:
 *
 * 1. **La urgencia no pinta la tarjeta entera**: la tarjeta es una superficie del sistema
 *    (`--bg-surface-card`) y el estado entra por el borde y el tinte del propio estado. La única
 *    tarjeta que **late** es la que pasó el SLA, que es lo que el sistema pide (§8.3) y además
 *    respeta `prefers-reduced-motion`.
 * 2. **El número de pedido, el cronómetro y las cantidades van en `font-mono` con `tabular-nums`**
 *    (§2.1): son valores que cambian o que se leen de un vistazo a dos metros.
 * 3. **El canal** (Mostrador / Retiro / Mesa) va al lado del número, como en la referencia: en la
 *    cocina, saber de dónde sale el pedido es la primera pregunta.
 *
 * Lo que la referencia muestra y acá **no** va, con su motivo: el monto de la comanda y el PIN no
 * existen en el payload de la bandeja —y la cocina no los necesita—; el "Pagado (Efectivo)" y el
 * teléfono enmascarado tampoco viajan en el carril de cocina. El tracker por estación
 * (Plancha/Armado/Empaque) no existe en el backend: no hay modelo de estaciones.
 */
const URGENCY_STYLES = {
  normal: "border-line-subtle bg-surface-card hover:bg-surface-elevated",
  warning: "border-status-prep-border bg-status-prep-bg",
  late: "border-status-sla-border bg-status-sla-bg shadow-glow-critical motion-safe:animate-pulse",
} as const;

const URGENCY_CHIP_STYLES = {
  normal: "bg-canvas/70 text-ink-secondary",
  warning: "bg-status-prep-bg text-status-prep-text",
  late: "bg-status-sla-bg text-status-sla-text",
} as const;

/** B3 — una comanda del tablero: lo que hay que cocinar, para quién y desde cuándo espera. */
export function OrderComandaCard({
  order,
  nowMs,
  timeZone,
  onUpdateStatus,
  warningMinutes,
  lateMinutes,
  isNew = false,
  disabled = false,
  disabledReason,
  showLocation = false,
}: OrderComandaCardProps) {
  const urgency = resolveComandaUrgency({
    stageChangedAt: order.stageChangedAt,
    nowMs,
    warningMinutes,
    lateMinutes,
  });
  const enteredAt = formatTimeInTimeZone(order.createdAt, timeZone);
  const pickupLabel = describeAdminPickup({
    pickupTime: order.pickupTime,
    pickupScheduled: order.pickupScheduled,
    timeZone,
    nowMs,
  });
  const StageIcon = urgency.level === "late" ? AlarmClock : Clock;
  const { label: channelLabel } = orderTypePresentation(order.type);

  return (
    <article
      data-urgency={urgency.level}
      data-order={order.id}
      {...(isNew ? { "data-new-order": "true" } : {})}
      className={[
        "flex flex-col gap-3 rounded-stitch-lg border p-4 transition-colors duration-200 motion-reduce:transition-none",
        URGENCY_STYLES[urgency.level],
        isNew ? "ring-2 ring-line-focus ring-offset-2 ring-offset-canvas" : "",
      ].join(" ")}
    >
      {/*
        El enlace cubre la información —lo que se lee— y las acciones quedan afuera: un botón dentro
        de un enlace es HTML inválido, y el mostrador sigue necesitando abrir el detalle para cobrar.
      */}
      <Link
        href={`/admin/orders/${order.id}`}
        aria-label={`Abrir orden ${order.orderNumber}`}
        className="flex flex-col gap-3 rounded-stitch-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-st-h2 font-bold tracking-tight tabular-nums text-brand-primary">
                {order.orderNumber}
              </span>
              <span className="rounded-stitch-sm bg-brand-primary-muted px-1.5 py-0.5 text-st-overline font-bold uppercase tracking-wider text-brand-primary">
                {channelLabel}
              </span>
            </div>
            <p className="mt-0.5 truncate text-st-body font-semibold text-ink">{order.customerName}</p>
            <p className="font-mono text-st-caption tabular-nums text-ink-muted">Entró {enteredAt ?? "—"}</p>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-st-caption font-semibold tabular-nums ${URGENCY_CHIP_STYLES[urgency.level]}`}
          >
            <StageIcon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
            {urgency.label}
          </span>
        </header>

        <ul className="flex flex-col gap-2 rounded-stitch-md bg-canvas/60 p-3">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              {/* El sistema pide la cantidad en un badge ámbar translúcido, en mono (§6.2). */}
              <span className="shrink-0 rounded-stitch-sm bg-brand-amber-soft px-2 py-0.5 font-mono text-st-caption font-bold tabular-nums text-brand-amber">
                {item.quantity}x
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-st-body font-bold text-ink">{item.productName}</p>
                {item.modifiers.length > 0 ? (
                  <p className="text-st-caption font-medium text-brand-amber">
                    {item.modifiers.map((modifier) => `• ${modifier.name}`).join(" ")}
                  </p>
                ) : null}
                {item.notes ? (
                  // La nota del chef es un llamado aparte, entre comillas y en el ámbar de cocina (§6.2).
                  <p className="mt-1 flex items-start gap-1.5 rounded-stitch-sm bg-status-prep-bg px-2 py-1 text-st-caption italic text-status-prep-text">
                    <MessageSquareText aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                    «{item.notes}»
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <p className="text-st-caption font-medium tabular-nums text-ink-secondary">
          {pickupLabel ?? `Retiro para hoy · ${channelLabel}`}
          {showLocation && order.locationName ? ` · ${order.locationName}` : ""}
        </p>
      </Link>

      <OrderActions
        layout="card"
        order={order}
        onUpdateStatus={onUpdateStatus}
        disabled={disabled}
        disabledReason={disabledReason}
      />
    </article>
  );
}
