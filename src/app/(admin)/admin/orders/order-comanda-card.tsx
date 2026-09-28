"use client";

import Link from "next/link";
import {
  AlarmClock,
  BellRing,
  Clock,
  Flame,
  Inbox,
  MessageSquareText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import { resolveOrderLane, type OrderLane } from "@/modules/orders/domain/order-lanes";
import { resolveRecommendedStart } from "@/modules/orders/domain/order-scheduling";
import { ORDER_SOURCE_LABELS, type OrderSource, type OrderStatus, type OrderType } from "@/modules/orders/domain/order.types";

import { describeAdminPickup } from "../_components/admin-pickup-timing";
import { OrderActions } from "../orders/order-actions";
import { resolveComandaUrgency } from "../orders/comanda-helpers";

/**
 * La **tarjeta de comanda**, una sola vez para las dos superficies.
 *
 * La usan Cocina (`/admin/kitchen`) y la bandeja del turno (`/admin/orders`): la comanda es el mismo
 * objeto y su composición es la misma —número, canal, cliente, items, modificadores, notas, urgencia y
 * **una** acción primaria—, así que tener dos tarjetas sería la misma regla escrita dos veces, que es
 * justamente el defecto que `A-64` documenta para los carriles. Lo que cambia entre superficies entra por
 * props y son **dos** cosas:
 *
 * - `detailHref`: el enlace al detalle del pedido. Lo tiene **Pedidos** (el detalle con la plata es suyo);
 *   Cocina **no** enlaza, porque el detalle no es de esta superficie (`kitchen.md` § *Fuera de scope*).
 * - `scheduledForAnotherDay`: el sello de «Programado» del grupo interno de ENTRADA de Cocina.
 */

export type ComandaCardOrder = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName: string;
  createdAt: string;
  /** Cuándo empezó la etapa actual: es lo que mide la urgencia. */
  stageChangedAt: string;
  /** Cuándo empezó la preparación: sin sello, el cronómetro no se muestra (no se inventa un inicio). */
  preparingAt?: string | null;
  /** Cuándo quedó listo: con `preparingAt` da la preparación real de la tarjeta de Listos. */
  readyAt?: string | null;
  pickupTime?: string | null;
  pickupScheduled?: boolean;
  /** Canal de origen. `null`/ausente = no declarado: la tarjeta sale **sin** etiqueta. */
  source?: OrderSource | null;
  /** Nombre del local: con más de una sucursal a la vista es lo primero que se pregunta. */
  locationName?: string | null;
  /** `Location.pickupLeadMinutes`: la autoridad del inicio recomendado, por local. */
  pickupLeadMinutes?: number | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    notes?: string | null;
    modifiers: Array<{ id: string; name: string }>;
  }>;
};

type OrderComandaCardProps = {
  order: ComandaCardOrder;
  nowMs: number;
  timeZone: string;
  onUpdateStatus: (status: OrderStatus, note?: string | null) => Promise<void>;
  warningMinutes?: number;
  lateMinutes?: number;
  /** Recién llegada: se resalta un momento para que el ojo la encuentre. */
  isNew?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** Muestra la sucursal: con más de una a la vista es la primera pregunta. */
  showLocation?: boolean;
  /** El pedido es de **otro día** del negocio: sello «Programado» (grupo interno de ENTRADA de Cocina). */
  scheduledForAnotherDay?: boolean;
  /** El detalle del pedido. **Sin** `href` (Cocina) la tarjeta no enlaza a ninguna parte. */
  detailHref?: string;
};

const LANE_ICONS: Record<OrderLane, LucideIcon> = {
  entry: Inbox,
  preparing: Flame,
  ready: BellRing,
};

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

function SourceBadge({ source }: { source?: OrderSource | null }) {
  // Un pedido histórico sin canal declarado se dibuja **sin** etiqueta: nunca una adivinada.
  if (!source) return null;

  return (
    <span className="rounded-stitch-sm bg-brand-primary-muted px-1.5 py-0.5 text-st-overline font-bold uppercase tracking-wider text-brand-primary">
      {ORDER_SOURCE_LABELS[source]}
    </span>
  );
}

function minutesBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;

  const startedAt = Date.parse(from);
  const finishedAt = Date.parse(to);
  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt)) return null;

  const minutes = Math.round((finishedAt - startedAt) / 60_000);

  return minutes >= 0 ? minutes : null;
}

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
  scheduledForAnotherDay = false,
  detailHref,
}: OrderComandaCardProps) {
  const lane = resolveOrderLane(order.status);
  const urgency = resolveComandaUrgency({
    stageChangedAt: order.stageChangedAt,
    nowMs,
    warningMinutes,
    lateMinutes,
    lane: lane ?? undefined,
  });
  const pickupLabel = describeAdminPickup({
    pickupTime: order.pickupTime,
    pickupScheduled: order.pickupScheduled,
    timeZone,
    nowMs,
  });
  const recommendedStart = resolveRecommendedStart({
    pickupTime: order.pickupTime,
    pickupLeadMinutes: order.pickupLeadMinutes,
  });
  const recommendedLabel = recommendedStart
    ? formatTimeInTimeZone(recommendedStart, timeZone)
    : null;
  // La preparación real, en la tarjeta de Listos: `preparingAt → readyAt`, nunca desde la creación.
  const prepMinutes = lane === "ready" ? minutesBetween(order.preparingAt, order.readyAt) : null;
  const StageIcon = urgency.level === "late" ? AlarmClock : Clock;
  const LaneIcon = lane ? LANE_ICONS[lane] : Clock;

  const header = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-st-h2 font-bold tracking-tight tabular-nums text-brand-primary">
          {order.orderNumber}
        </span>
        <SourceBadge source={order.source} />
        {scheduledForAnotherDay ? (
          <span className="rounded-stitch-sm bg-status-pending-bg px-1.5 py-0.5 text-st-overline font-bold uppercase tracking-wider text-status-pending-text">
            Programado
          </span>
        ) : null}
        {order.status === "confirmed" || order.status === "accepted" ? (
          <span className="rounded-stitch-sm bg-status-ready-bg px-1.5 py-0.5 text-st-overline font-bold uppercase tracking-wider text-status-ready-text">
            Confirmado
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-st-body font-semibold text-ink">{order.customerName}</p>
      <p className="font-mono text-st-caption tabular-nums text-ink-muted">
        Entró {formatTimeInTimeZone(order.createdAt, timeZone) || "—"}
      </p>
    </>
  );

  const urgencyChips = (
    <span className="flex shrink-0 flex-col items-end gap-1">
      {/* En preparando el cronómetro se rotula `PREP N m` y cuenta desde `preparingAt` (la referencia). */}
      {urgency.kitchenTimer ? (
        <span
          data-testid="kitchen-prep-timer"
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-st-caption font-semibold tabular-nums ${URGENCY_CHIP_STYLES[urgency.level]}`}
        >
          {urgency.kitchenTimer}
        </span>
      ) : null}
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-st-caption font-semibold tabular-nums ${URGENCY_CHIP_STYLES[urgency.level]}`}
      >
        <StageIcon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
        {urgency.label}
      </span>
      <span className="inline-flex items-center gap-1 text-st-overline font-bold uppercase tracking-wider text-ink-muted">
        <LaneIcon aria-hidden="true" className="h-3 w-3" strokeWidth={2.4} />
        {lane ?? "Fuera del tablero"}
      </span>
    </span>
  );

  return (
    <article
      data-urgency={urgency.level}
      data-order={order.id}
      data-lane={lane ?? "fuera"}
      {...(isNew ? { "data-new-order": "true" } : {})}
      className={[
        "flex flex-col gap-3 rounded-stitch-lg border p-4 transition-colors duration-200 motion-reduce:transition-none",
        URGENCY_STYLES[urgency.level],
        isNew ? "ring-2 ring-line-focus ring-offset-2 ring-offset-canvas" : "",
      ].join(" ")}
    >
      {/*
        El enlace cubre la información y las acciones quedan afuera (un botón dentro de un enlace es HTML
        inválido). Sin `detailHref` —Cocina— no hay enlace: el detalle del pedido no es de esa superficie.
      */}
      {detailHref ? (
        <Link
          href={detailHref}
          aria-label={`Abrir orden ${order.orderNumber}`}
          className="flex flex-col gap-3 rounded-stitch-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">{header}</div>
            {urgencyChips}
          </header>
          <OrderItems order={order} />
          <PickupLine
            pickupLabel={pickupLabel}
            recommendedLabel={recommendedLabel}
            scheduled={Boolean(order.pickupScheduled)}
          />
        </Link>
      ) : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">{header}</div>
            {urgencyChips}
          </header>
          <OrderItems order={order} />
          <PickupLine
            pickupLabel={pickupLabel}
            recommendedLabel={recommendedLabel}
            scheduled={Boolean(order.pickupScheduled)}
          />
        </>
      )}

      {showLocation && order.locationName ? (
        <p className="text-st-caption font-medium text-ink-secondary">{order.locationName}</p>
      ) : null}

      {/* Listos: el pedido ya salió de cocina. No hay acción y el tiempo de preparación queda a la vista. */}
      {lane === "ready" ? (
        <div className="rounded-stitch-md bg-status-ready-bg/60 px-3 py-2">
          <p className="text-st-body font-bold text-status-ready-text">
            ✓ LISTO{prepMinutes !== null ? ` · Preparación ${prepMinutes} min` : ""}
          </p>
          <p className="mt-0.5 text-st-caption text-ink-secondary">Espera mostrador / Caja</p>
        </div>
      ) : null}

      {lane === "entry" || lane === "preparing" ? (
        <OrderActions
          layout="card"
          order={order}
          onUpdateStatus={onUpdateStatus}
          disabled={disabled}
          disabledReason={disabledReason}
        />
      ) : null}

      {/*
        Sin `preparingAt` un pedido aceptado está esperando, no cocinándose: lo dice en vez de mostrar un
        cronómetro que nadie arrancó.
      */}
      {lane === "entry" && order.status !== "new" && !order.preparingAt ? (
        <p className="text-st-caption font-semibold text-ink-secondary" data-testid="kitchen-waiting-start">
          ✓ Aceptado · espera inicio
        </p>
      ) : null}
    </article>
  );
}

function OrderItems({ order }: { order: ComandaCardOrder }) {
  return (
    <ul className="flex flex-col gap-2 rounded-stitch-md bg-canvas/60 p-3">
      {order.items.map((item) => (
        <li key={item.id} className="flex items-start gap-2">
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
              <p className="mt-1 flex items-start gap-1.5 rounded-stitch-sm bg-status-prep-bg px-2 py-1 text-st-caption italic text-status-prep-text">
                <MessageSquareText aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                «{item.notes}»
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Cuándo se retira y —si es programado— cuándo conviene arrancar. */
function PickupLine({
  pickupLabel,
  recommendedLabel,
  scheduled,
}: {
  pickupLabel: string | null;
  recommendedLabel: string | null;
  scheduled: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-stitch-md bg-canvas/40 px-2.5 py-1.5 text-st-caption font-medium tabular-nums text-ink-secondary">
      {/* Un pedido del POS no tiene hora prometida (`pickupTime: null`): no se le inventa una. */}
      <span>{pickupLabel ?? "Retiro: lo antes posible"}</span>
      {recommendedLabel && scheduled ? (
        <span className="text-status-pending-text">
          Inicio recomendado <strong className="font-bold">{recommendedLabel}</strong>
        </span>
      ) : null}
    </p>
  );
}
