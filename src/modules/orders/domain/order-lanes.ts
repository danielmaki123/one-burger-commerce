import type { OrderStatus } from "./order.types";

/**
 * A-64 — el mapa **canónico** estado→carril, en un solo lugar.
 *
 * La regla vivía cinco veces —`comandaLane`, `orderBucket`, `getAdminOrderSolidStatus`, `ORDER_JOURNEY`
 * y `DISPATCHED_STATUSES`— y no todas decían lo mismo: `confirmed` caía «en preparación» en dos de las
 * copias. Cuando una regla no tiene dueño, la escribe la superficie que la necesita, y cinco superficies
 * escribieron cinco mapas. Este archivo es el dueño: lo consumen **Cocina y Pedidos**.
 *
 * Vive en `orders/domain` y no en la app porque es una regla de negocio del pedido (qué etapa está
 * esperando trabajo de cocina y cuál ya está en el fuego), no una decisión de presentación.
 *
 * **Regla de la spec de Cocina** ([`kitchen.md`](../../../../ops/design/screens/kitchen.md) § *Carriles*):
 * `confirmed` está en **ENTRADA** —aceptado todavía no es «en el fuego»—, y `accepted`/`ready` se
 * conservan en el carril de su equivalente (`confirmed`/`ready_for_pickup`) para no dejar sin superficie a
 * un estado del esquema, aunque mesa y delivery estén fuera del MVP.
 */

export type OrderLane = "entry" | "preparing" | "ready";

export type OrderLaneMeta = {
  id: OrderLane;
  label: string;
  /** El copy del carril vacío: un tablero en blanco no dice si no hay pedidos o si algo se rompió. */
  empty: string;
};

/** Los tres carriles, en el orden en que la cocina los mira. */
export const COMANDA_LANES: readonly OrderLaneMeta[] = [
  {
    id: "entry",
    label: "Entrada",
    empty: "No hay comandas nuevas. Cuando entre un pedido, aparece acá.",
  },
  {
    id: "preparing",
    label: "Preparando",
    empty: "Nada en el fuego. Aceptá una comanda para empezar.",
  },
  {
    id: "ready",
    label: "Listos",
    empty: "Todavía no hay nada listo para entregar.",
  },
];

/** Los estados que el tablero de cocina dibuja, con su carril. */
const LANE_BY_STATUS: Partial<Record<OrderStatus, OrderLane>> = {
  new: "entry",
  confirmed: "entry",
  // Equivalente de mesa de `confirmed` (fuera del MVP, pero el esquema lo tiene).
  accepted: "entry",
  preparing: "preparing",
  ready: "ready",
  ready_for_pickup: "ready",
};

/** Todos los estados que **sí** están en el tablero. Es la red del mapa: ningún estado queda sin dueño. */
export const KITCHEN_BOARD_STATUSES: readonly OrderStatus[] = Object.keys(
  LANE_BY_STATUS,
) as OrderStatus[];

/**
 * El carril de un estado, o `null` si el pedido ya salió del tablero (retirado, cerrado, cancelado).
 */
export function resolveOrderLane(status: OrderStatus): OrderLane | null {
  return LANE_BY_STATUS[status] ?? null;
}

/**
 * Reparte los pedidos en sus carriles conservando el orden que trae la lista (que ya viene ordenada por
 * hora prometida) y **sin inventar carriles vacíos**: los tres existen siempre.
 */
export function groupComandasByLane<T extends { status: OrderStatus }>(
  orders: readonly T[],
): Record<OrderLane, T[]> {
  const grouped: Record<OrderLane, T[]> = { entry: [], preparing: [], ready: [] };

  for (const order of orders) {
    const lane = resolveOrderLane(order.status);
    if (lane) grouped[lane].push(order);
  }

  return grouped;
}

/** Los contadores de la cabecera. `total` cuenta sólo lo que está en el tablero. */
export function comandaCounters(orders: readonly { status: OrderStatus }[]): {
  entry: number;
  preparing: number;
  ready: number;
  total: number;
} {
  const grouped = groupComandasByLane(orders);

  return {
    entry: grouped.entry.length,
    preparing: grouped.preparing.length,
    ready: grouped.ready.length,
    total: grouped.entry.length + grouped.preparing.length + grouped.ready.length,
  };
}
