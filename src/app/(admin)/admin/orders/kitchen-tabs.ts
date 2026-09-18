import type { OrderStatus } from "@/modules/orders/domain/order.types";

import { comandaLane } from "./comanda-helpers";

/**
 * Punto 3 del roadmap (2026-09-18) — los tabs del **modo cocina**.
 *
 * Son las cinco preguntas de la cocina, en el orden en que las hace: todo el turno, lo que nadie tomó,
 * lo que está en el fuego, lo que espera en el mostrador y lo último que salió (para el «¿ya salió el de
 * Ana?»). **Sin «Cerradas» y sin «Historial»**: eso es auditoría del turno y vive en el panel.
 *
 * Filtra sobre los pedidos que la pantalla **ya trae** (misma API, mismos filtros) y conserva el orden
 * recibido: el tablero y la lista ya vienen ordenados por hora prometida (B0). No pide nada nuevo al
 * servidor: es presentación.
 */

/** Cuánto dura «hace poco» en el tab de despachadas, en minutos. */
export const KITCHEN_DISPATCHED_WINDOW_MINUTES = 30;

export type KitchenTab = "all" | "new" | "preparing" | "ready" | "dispatched";

export const KITCHEN_TABS: ReadonlyArray<{ id: KitchenTab; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "new", label: "Nuevas" },
  { id: "preparing", label: "Preparando" },
  { id: "ready", label: "Listas" },
  { id: "dispatched", label: "Despachadas hace poco" },
];

/**
 * Lo que ya salió del local. El retiro es lo normal; `served` y `delivered` se incluyen porque el
 * esquema los tiene y alguna sucursal podría usarlos: lo que importa es que el pedido **cerró su
 * entrega**, no con qué nombre se guardó.
 */
const DISPATCHED_STATUSES: readonly OrderStatus[] = ["picked_up", "served", "delivered"];

/** Una etapa que todavía no terminó: sigue en el mostrador o en el fuego, no se despachó. */
function isDispatched(status: OrderStatus): boolean {
  return DISPATCHED_STATUSES.includes(status);
}

/**
 * La última etapa del pedido que entró en la ventana. Una fecha ilegible no cuenta como despacho: es
 * mejor no mostrarla que mostrar una comanda vieja como si acabara de salir.
 */
function isWithinDispatchedWindow(
  order: { stageChangedAt: string },
  nowMs: number,
  windowMinutes: number,
): boolean {
  const stageAt = Date.parse(order.stageChangedAt);
  if (Number.isNaN(stageAt)) return false;

  return nowMs - stageAt <= windowMinutes * 60_000;
}

/**
 * Los pedidos de un tab del modo cocina. Un tab desconocido **no filtra nada**: una URL vieja no puede
 * dejar la pantalla en blanco.
 */
export function filterOrdersForKitchenTab<T extends { status: OrderStatus; stageChangedAt: string }>(
  orders: readonly T[],
  tab: string,
  nowMs: number,
): T[] {
  switch (tab) {
    case "new":
      return orders.filter((order) => comandaLane(order.status) === "pending");
    case "preparing":
      return orders.filter((order) => comandaLane(order.status) === "preparing");
    case "ready":
      return orders.filter((order) => comandaLane(order.status) === "ready");
    case "dispatched":
      return orders.filter(
        (order) =>
          isDispatched(order.status) &&
          isWithinDispatchedWindow(order, nowMs, KITCHEN_DISPATCHED_WINDOW_MINUTES),
      );
    default:
      return [...orders];
  }
}
