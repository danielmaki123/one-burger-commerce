"use client";

import { BellRing, Flame, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { OrderStatus } from "@/modules/orders/domain/order.types";

import {
  COMANDA_LANES,
  comandaCounters,
  groupComandasByLane,
  thresholdsForLane,
  type ComandaLane,
  type ComandaThresholdsByLane,
} from "./comanda-helpers";
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
  /** Umbrales del local (B5): «Por aceptar» y cocina avisan a minutos distintos. */
  thresholds: ComandaThresholdsByLane;
  /** Con más de una sucursal a la vista, cada comanda dice de dónde es. */
  showLocation?: boolean;
  /** Término buscado: cuando el carril está vacío, el vacío explica que es por la búsqueda. */
  searchTerm?: string;
};

/**
 * Cada carril tiene el color de su estado en el sistema (`design-system.md` §1.4): recepción en azul
 * cielo, producción en ámbar y listo en esmeralda. Es lo que permite leer el tablero de un vistazo
 * sin contar columnas.
 */
const LANE_STYLES: Record<
  ComandaLane,
  { dot: string; switcher: string; header: string; icon: LucideIcon }
> = {
  pending: {
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

/**
 * El título de un carril vacío, en tono gastronómico como pide el sistema para los estados vacíos
 * (§6.3): un tablero en blanco no dice si no hay pedidos o si algo se rompió. La aclaración de abajo
 * es la que ya existía (explica qué va a aparecer); el título es lo que se lee a dos metros.
 */
const LANE_EMPTY_TITLES: Record<ComandaLane, string> = {
  pending: "Sin comandas entrantes",
  preparing: "Parrilla despejada",
  ready: "Mostrador limpio",
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

          return (
            <button
              key={lane.id}
              type="button"
              aria-pressed={isActive}
              className={[
                "flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-stitch-md border px-2 text-st-caption font-bold transition-colors duration-150 motion-reduce:transition-none",
                isActive
                  ? style.switcher
                  : "border-transparent text-ink-muted hover:bg-surface-elevated hover:text-ink",
              ].join(" ")}
              onClick={() => onActiveLaneChange(lane.id)}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {lane.label} {count}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 min-w-0 gap-3 lg:grid-cols-3">
        {COMANDA_LANES.map((lane) => {
          const laneOrders = grouped[lane.id];
          // En celular se ve el carril elegido; en escritorio, los tres.
          const visibility = lane.id === activeLane ? "flex" : "hidden lg:flex";
          const style = LANE_STYLES[lane.id];
          const EmptyIcon = style.icon;

          return (
            <section
              key={lane.id}
              aria-label={lane.label}
              className={`min-h-0 min-w-0 flex-col gap-3 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto lg:pr-1 ${visibility}`}
            >
              <h2
                className={`sticky top-0 z-10 -mx-1 flex items-center justify-between gap-2 rounded-stitch-md border px-3 py-2 backdrop-blur ${style.header}`}
              >
                <span className="flex items-center gap-2 text-st-body font-bold">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${style.dot}`} />
                  {lane.label} ({laneOrders.length})
                </span>
              </h2>

              {laneOrders.length === 0 ? (
                // Estado vacío con alma (§6.3): ícono con contenedor, título, aclaración y latido.
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
                  <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface-low px-2.5 py-1 font-mono text-panel-meta text-ink-muted">
                    {/* DS v4 (`MOTION.md`): el pulso está reservado al SLA vencido o a la pérdida de
                        sincronización. Un carril vacío en reposo no es ninguna de las dos cosas. */}
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-status-pending-dot"
                    />
                    Esperando solicitudes
                  </span>
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
                    warningMinutes={thresholdsForLane(thresholds, lane.id).warningMinutes}
                    lateMinutes={thresholdsForLane(thresholds, lane.id).lateMinutes}
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
