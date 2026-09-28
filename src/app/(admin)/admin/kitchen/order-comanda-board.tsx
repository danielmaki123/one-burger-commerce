"use client";

import { BellRing, Flame, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  COMANDA_LANES,
  comandaCounters,
  groupComandasByLane,
  type OrderLane,
} from "@/modules/orders/domain/order-lanes";
import { groupScheduledOrders } from "@/modules/orders/domain/order-scheduling";
import type { KitchenOrderProjection } from "@/modules/orders/features/list-kitchen-orders/kitchen-order-projection";
import type { OrderStatus } from "@/modules/orders/domain/order.types";

import { thresholdsForLane, type ComandaThresholdsByLane } from "../orders/comanda-helpers";
import { OrderComandaCard } from "../orders/order-comanda-card";
import { Button } from "@/shared/ui/button";

/**
 * El tablero de **Cocina**: tres carriles con scroll propio, como la referencia aprobada.
 *
 * Es la traducción de [`kitchen-reference.html`](../../../../../ops/design/screens/kitchen-reference.html):
 * **ENTRADA** (con sus dos grupos internos, *Ahora* y *Programados*) · **PREPARANDO** · **LISTOS**, cada
 * uno con su encabezado pegajoso y **su** scroll —la cocina mira la columna que le toca sin perder de
 * vista cuánto hay en las otras—. En tablet y celular se ve **un carril por vez** con un conmutador: tres
 * columnas apretadas en 375 px obligan a hacer zoom justo cuando hay prisa.
 *
 * Los carriles existen **siempre**, aunque estén vacíos, y cada vacío explica qué va a aparecer: un
 * tablero en blanco no dice si no hay pedidos o si algo se rompió.
 */

const LANE_STYLES: Record<OrderLane, { dot: string; switcher: string; header: string; icon: LucideIcon }> = {
  entry: {
    dot: "bg-status-pending-dot",
    switcher: "border-status-pending-border bg-status-pending-bg text-status-pending-text",
    header: "border-status-pending-border bg-status-pending-bg",
    icon: Inbox,
  },
  preparing: {
    dot: "bg-status-prep-dot",
    switcher: "border-status-prep-border bg-status-prep-bg text-status-prep-text",
    header: "border-status-prep-border bg-status-prep-bg",
    icon: Flame,
  },
  ready: {
    dot: "bg-status-ready-dot",
    switcher: "border-status-ready-border bg-status-ready-bg text-status-ready-text",
    header: "border-status-ready-border bg-status-ready-bg",
    icon: BellRing,
  },
};

const LANE_EMPTY_TITLES: Record<OrderLane, string> = {
  entry: "Sin comandas entrantes",
  preparing: "Parrilla despejada",
  ready: "Mostrador limpio",
};

/** Los títulos de los grupos internos de ENTRADA (referencia: `Ahora` / `Programados`). */
const ENTRY_GROUP_LABELS = {
  now: { title: "Ahora", hint: "requiere atención" },
  scheduled: { title: "Programados", hint: "otro día" },
} as const;

type OrderComandaBoardProps = {
  orders: KitchenOrderProjection[];
  nowMs: number;
  timeZone: string;
  /** El día del negocio, para separar los programados de otro día. */
  today: string;
  newOrderIds?: string[];
  activeLane: OrderLane;
  onActiveLaneChange: (lane: OrderLane) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, note?: string | null) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  thresholds: ComandaThresholdsByLane;
  showLocation?: boolean;
  searchTerm?: string;
};

export function OrderComandaBoard({
  orders,
  nowMs,
  timeZone,
  today,
  newOrderIds = [],
  activeLane,
  onActiveLaneChange,
  onUpdateStatus,
  disabled = false,
  disabledReason,
  thresholds,
  showLocation = false,
  searchTerm = "",
}: OrderComandaBoardProps) {
  const grouped = groupComandasByLane(orders);
  const counters = comandaCounters(orders);

  function renderCard(order: KitchenOrderProjection, scheduledForAnotherDay = false) {
    return (
      <OrderComandaCard
        key={order.id}
        order={{
          ...order,
          locationName: order.location.name,
          pickupLeadMinutes: order.location.pickupLeadMinutes,
        }}
        nowMs={nowMs}
        timeZone={timeZone}
        isNew={newOrderIds.includes(order.id)}
        disabled={disabled}
        disabledReason={disabledReason}
        warningMinutes={thresholdsForLane(thresholds, "entry").warningMinutes}
        lateMinutes={thresholdsForLane(thresholds, "entry").lateMinutes}
        showLocation={showLocation}
        scheduledForAnotherDay={scheduledForAnotherDay}
        // **Sin** `detailHref`: el detalle del pedido tiene dinero y es de Pedidos.
        onUpdateStatus={(status, note) => onUpdateStatus(order.id, status, note)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Conmutador de carriles: visible en tablet y celular, donde no entran las tres columnas. */}
      <div
        role="group"
        aria-label="Carril de comandas"
        className="flex shrink-0 gap-1.5 rounded-stitch-lg border border-line-subtle bg-surface-card p-1.5 lg:hidden"
      >
        {COMANDA_LANES.map((lane) => {
          const count = counters[lane.id];
          const isActive = lane.id === activeLane;
          const style = LANE_STYLES[lane.id];

          return (
            <Button
              key={lane.id}
              variant="ghost"
              aria-pressed={isActive}
              className={[
                "flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-stitch-md border px-2 text-st-caption font-bold hover:bg-surface-elevated",
                isActive ? style.switcher : "border-transparent text-ink-muted hover:text-ink",
              ].join(" ")}
              onClick={() => onActiveLaneChange(lane.id)}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {lane.label} {count}
            </Button>
          );
        })}
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 gap-3 lg:grid-cols-3">
        {COMANDA_LANES.map((lane) => {
          const laneOrders = grouped[lane.id];
          // En tablet y celular se ve el carril elegido; en escritorio, los tres.
          const visibility = lane.id === activeLane ? "flex" : "hidden lg:flex";
          const style = LANE_STYLES[lane.id];
          const EmptyIcon = style.icon;
          const laneThresholds = thresholdsForLane(thresholds, lane.id);
          const scheduled =
            lane.id === "entry"
              ? groupScheduledOrders(laneOrders, { today, timeZone })
              : null;

          return (
            <section
              key={lane.id}
              aria-label={lane.label}
              className={`min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 ${visibility}`}
            >
              <h2
                className={`sticky top-0 z-10 flex items-center justify-between gap-2 rounded-stitch-md border px-3 py-2 backdrop-blur ${style.header}`}
              >
                <span className="flex items-center gap-2 text-st-body font-bold uppercase tracking-wider">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${style.dot}`} />
                  {lane.label}
                </span>
                <span className="rounded-full bg-canvas/50 px-2 py-0.5 font-mono text-st-caption font-bold tabular-nums">
                  {laneOrders.length}
                </span>
              </h2>

              {laneOrders.length === 0 ? (
                <div className="rounded-stitch-lg border border-dashed border-line-subtle bg-surface-card/60 px-4 py-12 text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-stitch-2xl bg-surface-low">
                    <EmptyIcon aria-hidden="true" className="h-7 w-7 text-ink-muted" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-4 text-st-h3 font-bold text-ink">
                    {searchTerm ? "Sin coincidencias" : LANE_EMPTY_TITLES[lane.id]}
                  </h3>
                  <p className="mx-auto mt-1 max-w-sm text-st-caption text-ink-secondary">
                    {searchTerm
                      ? `Ninguna comanda de este carril coincide con «${searchTerm}».`
                      : lane.empty}
                  </p>
                </div>
              ) : scheduled ? (
                // ENTRADA se lee en dos grupos: lo que se puede tomar ya y lo comprometido para otro día.
                <>
                  {scheduled.now.length > 0 ? (
                    <p
                      data-testid="kitchen-entry-now"
                      className="flex items-center justify-between px-1 text-st-overline font-bold uppercase tracking-wider text-ink-secondary"
                    >
                      <span>{ENTRY_GROUP_LABELS.now.title}</span>
                      <span className="font-medium normal-case tracking-normal">
                        {ENTRY_GROUP_LABELS.now.hint}
                      </span>
                    </p>
                  ) : null}
                  {scheduled.now.map((order) => renderCard(order))}

                  {scheduled.scheduled.length > 0 ? (
                    <p
                      data-testid="kitchen-entry-scheduled"
                      className="mt-2 flex items-center justify-between border-t border-line-subtle px-1 pt-2 text-st-overline font-bold uppercase tracking-wider text-ink-secondary"
                    >
                      <span>{ENTRY_GROUP_LABELS.scheduled.title}</span>
                      <span className="font-mono tabular-nums">{scheduled.scheduled.length}</span>
                    </p>
                  ) : null}
                  {scheduled.scheduled.map((order) => renderCard(order, true))}
                </>
              ) : (
                laneOrders.map((order) =>
                  renderCard(order, false),
                )
              )}

              {/* El umbral del carril, para que el número no sea un misterio (referencia: cabecera). */}
              <p className="px-1 text-panel-meta text-ink-muted">
                Avisa a los <span className="font-mono tabular-nums">{laneThresholds.warningMinutes}</span> min ·
                atrasada a los <span className="font-mono tabular-nums">{laneThresholds.lateMinutes}</span> min
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
