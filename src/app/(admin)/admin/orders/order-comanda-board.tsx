"use client";

import type { OrderStatus } from "@/modules/orders/domain/order.types";

import { COMANDA_LANES, comandaCounters, groupComandasByLane, type ComandaLane } from "./comanda-helpers";
import { OrderComandaCard, type ComandaOrder } from "./order-comanda-card";

type OrderComandaBoardProps = {
  orders: ComandaOrder[];
  nowMs: number;
  timeZone: string;
  /** Pedidos que aparecieron solos (B1): se resaltan hasta que alguien los mira. */
  newOrderIds?: string[];
  /** Carril visible en celular; en escritorio se ven los tres. */
  activeLane: ComandaLane;
  onActiveLaneChange: (lane: ComandaLane) => void;
  onUpdateStatus: (
    orderId: string,
    status: OrderStatus,
    note?: string | null,
  ) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  warningMinutes?: number;
  lateMinutes?: number;
  /** Con más de una sucursal a la vista, cada comanda dice de dónde es. */
  showLocation?: boolean;
};

/**
 * B3 — el tablero de comandas.
 *
 * **Escritorio (≥1024 px)**: tres columnas —Por aceptar · En preparación · Listas—, cada una con su
 * encabezado pegajoso y su propio scroll: la cocina mira la columna que le toca sin perder de vista
 * cuánto hay en las otras.
 *
 * **Celular**: un carril por vez con un conmutador segmentado que dice cuántas hay en cada uno. Tres
 * columnas apretadas en 375 px obligan a hacer zoom justo cuando hay prisa.
 *
 * Los carriles existen **siempre** (aunque estén vacíos) y cada vacío explica qué va a aparecer:
 * un tablero en blanco no dice si no hay pedidos o si algo se rompió.
 */
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
  warningMinutes,
  lateMinutes,
  showLocation = false,
}: OrderComandaBoardProps) {
  const grouped = groupComandasByLane(orders);
  const counters = comandaCounters(orders);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Conmutador de carriles: solo en celular, donde no entran las tres columnas. */}
      <div
        role="group"
        aria-label="Carril de comandas"
        className="flex gap-1.5 rounded-panel border border-border bg-card p-1.5 lg:hidden"
      >
        {COMANDA_LANES.map((lane) => {
          const count = counters[lane.id];
          const isActive = lane.id === activeLane;

          return (
            <button
              key={lane.id}
              type="button"
              aria-pressed={isActive}
              className={[
                "min-h-11 flex-1 rounded-xl px-2 text-sm font-bold transition-colors duration-150 motion-reduce:transition-none",
                isActive
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              ].join(" ")}
              onClick={() => onActiveLaneChange(lane.id)}
            >
              {lane.label} {count}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-cols-3">
        {COMANDA_LANES.map((lane) => {
          const laneOrders = grouped[lane.id];
          // En celular se ve el carril elegido; en escritorio, los tres.
          const visibility = lane.id === activeLane ? "flex" : "hidden lg:flex";

          return (
            <section
              key={lane.id}
              aria-label={lane.label}
              className={`min-h-0 flex-col gap-3 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto lg:pr-1 ${visibility}`}
            >
              <h2 className="sticky top-0 z-10 -mx-1 flex items-center justify-between rounded-xl bg-background/95 px-2 py-2 font-heading text-base font-bold text-foreground backdrop-blur">
                <span>
                  {lane.label} ({laneOrders.length})
                </span>
              </h2>

              {laneOrders.length === 0 ? (
                <p className="rounded-panel border border-dashed border-border bg-card/60 px-4 py-6 text-sm text-muted-foreground">
                  {lane.empty}
                </p>
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
                    warningMinutes={warningMinutes}
                    lateMinutes={lateMinutes}
                    showLocation={showLocation}
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
