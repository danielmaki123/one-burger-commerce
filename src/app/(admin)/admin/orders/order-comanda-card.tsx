"use client";

import { AlarmClock, Clock, MessageSquareText } from "lucide-react";

import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import type { OrderStatus, OrderType } from "@/modules/orders/domain/order.types";

import { describeAdminPickup } from "../_components/admin-pickup-timing";
import { OrderActions } from "./order-actions";
import { resolveComandaUrgency } from "./comanda-helpers";

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
};

/**
 * El borde y el fondo de la urgencia. Se usan **tokens** y nunca un `border-left` de color
 * (prohibido por la guía): la etapa se ve por el fondo completo y por el chip, que además dice el
 * tiempo en palabras.
 */
const URGENCY_STYLES = {
  normal: "bg-card border-border",
  warning: "bg-warning border-warning-strong",
  late: "bg-danger border-danger-strong",
} as const;

const URGENCY_CHIP_STYLES = {
  normal: "text-muted-foreground",
  warning: "text-warning-foreground",
  late: "text-danger-foreground",
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

  return (
    <article
      data-urgency={urgency.level}
      data-order={order.id}
      {...(isNew ? { "data-new-order": "true" } : {})}
      className={[
        "flex flex-col gap-3 rounded-panel border-2 p-4 shadow-sm transition-colors duration-200 motion-reduce:transition-none",
        URGENCY_STYLES[urgency.level],
        isNew ? "ring-2 ring-brand ring-offset-2 ring-offset-background" : "",
      ].join(" ")}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="font-heading text-title font-bold tabular-nums text-foreground">
            {order.orderNumber}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            Entró {enteredAt ?? "—"}
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums ${URGENCY_CHIP_STYLES[urgency.level]}`}
        >
          <StageIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
          {urgency.label}
        </span>
      </header>

      <p className="text-lg font-bold leading-snug text-foreground">{order.customerName}</p>

      <ul className="flex flex-col gap-2">
        {order.items.map((item) => (
          <li key={item.id} className="text-sm text-foreground">
            <span className="font-semibold tabular-nums">
              {item.quantity} × {item.productName}
            </span>
            {item.modifiers.length > 0 ? (
              <span className="ml-1 text-muted-foreground">
                ({item.modifiers.map((modifier) => modifier.name).join(", ")})
              </span>
            ) : null}
            {item.notes ? (
              <span className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-warning-foreground">
                <MessageSquareText aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                {item.notes}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="text-xs font-semibold text-foreground tabular-nums">
        {pickupLabel ?? `Retiro para hoy · ${order.type === "pickup" ? "Retiro" : order.type}`}
      </p>

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
