"use client";

import { BellRing, Flame, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  COMANDA_LANES,
  comandaCounters,
  groupComandasByLane,
  type OrderLane,
} from "@/modules/orders/domain/order-lanes";
import type { OrderStatus } from "@/modules/orders/domain/order.types";

import {
  thresholdsForLane,
  type ComandaThresholdsByLane,
} from "./comanda-helpers";
import { OrderComandaCard, type ComandaCardOrder } from "./order-comanda-card";
import { Button } from "@/shared/ui/button";

/**
 * El tablero de comandas de **Órdenes**: el turno repartido en los tres carriles.
 *
 * `TASK-ORDERS-KITCHEN-RUNTIME-002` — de acá salió el **modo cocina** (la superficie propia es
 * `/admin/kitchen`), pero el tablero se queda: la bandeja del turno sigue mostrando lo activo en carriles
 * y lo cerrado como lista. Lo que cambió es **de dónde sale la regla**: una sola vez, del dominio
 * (`orders/domain/order-lanes`), así que `confirmed` está en ENTRADA en las dos superficies y ninguna
 * puede volver a decidir distinto (`A-64`).
 *
 * La **tarjeta** es la misma que la de Cocina (`order-comanda-card.tsx`). La única diferencia de esta
 * superficie es que acá sí enlaza al detalle del pedido —tiene dinero y es de Pedidos—: la cocina no
 * enlaza, porque el detalle no es suyo.
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

type OrderComandaBoardProps = {
  orders: ComandaCardOrder[];
  nowMs: number;
  timeZone: string;
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

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Conmutador de carriles: solo en celular, donde no entran las tres columnas. */}
      <div
        role="group"
        aria-label="Carril de comandas"
        className="flex gap-1.5 rounded-stitch-lg border border-line-subtle bg-surface-card p-1.5 lg:hidden"
      >
        {COMANDA_LANES.map((lane) => {
          const count = counters[lane.id];
          const isActive = lane.id === activeLane;
          const style = LANE_STYLES[lane.id];
          const label = lane.label;

          return (
            <Button
              key={lane.id}
              variant="ghost"
              aria-pressed={isActive}
              className={[
                "flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-stitch-md border px-2 text-st-caption font-bold hover:bg-surface-elevated",
                isActive
                  ? style.switcher
                  : "border-transparent text-ink-muted hover:text-ink",
              ].join(" ")}
              onClick={() => onActiveLaneChange(lane.id)}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {label} {count}
            </Button>
          );
        })}
      </div>

      <div className="grid min-h-0 min-w-0 gap-3 lg:grid-cols-3">
        {COMANDA_LANES.map((lane) => {
          const laneOrders = grouped[lane.id];
          const visibility = lane.id === activeLane ? "flex" : "hidden lg:flex";
          const style = LANE_STYLES[lane.id];
          const EmptyIcon = style.icon;
          const label = lane.label;
          const laneThresholds = thresholdsForLane(thresholds, lane.id);

          return (
            <section
              key={lane.id}
              aria-label={label}
              className={`min-h-0 min-w-0 flex-col gap-3 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto lg:pr-1 ${visibility}`}
            >
              <h2
                className={`sticky top-0 z-10 -mx-1 flex items-center justify-between gap-2 rounded-stitch-md border px-3 py-2 backdrop-blur ${style.header}`}
              >
                <span className="flex items-center gap-2 text-st-body font-bold">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${style.dot}`} />
                  {label} ({laneOrders.length})
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
              ) : (
                laneOrders.map((order) => (
                  <OrderComandaCard
                    key={order.id}
                    order={order}
                    nowMs={nowMs}
                    timeZone={timeZone}
                    isNew={newOrderIds.includes(order.id)}
                    disabled={disabled}
                    disabledReason={disabledReason}
                    warningMinutes={laneThresholds.warningMinutes}
                    lateMinutes={laneThresholds.lateMinutes}
                    showLocation={showLocation}
                    // Acá el detalle **sí** es de esta superficie: es la bandeja del mostrador.
                    detailHref={`/admin/orders/${order.id}`}
                    onUpdateStatus={(status, note) => onUpdateStatus(order.id, status, note)}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
