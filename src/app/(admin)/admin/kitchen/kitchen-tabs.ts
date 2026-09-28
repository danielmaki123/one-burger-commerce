import { resolveOrderLane, type OrderLane } from "@/modules/orders/domain/order-lanes";
import type { OrderStatus } from "@/modules/orders/domain/order.types";

import { resolveComandaUrgency, thresholdsForLane, type ComandaThresholdsByLane } from "../orders/comanda-helpers";

/**
 * Los filtros del tablero de **Cocina**: por carril y «solo atrasadas».
 *
 * La spec no tiene los cinco tabs del viejo modo cocina («Nuevas», «Despachadas hace poco»): esos eran de
 * la pantalla de Órdenes, donde cocina y mostrador compartían superficie. En `/admin/kitchen` los carriles
 * **son** el contenido, y el filtro de carril es el que el **conmutador** usa en tablet y celular, donde se
 * ve uno por vez (spec § *Tablet* / § *Mobile*).
 *
 * Filtra sobre los pedidos que la pantalla **ya trae**: misma API, mismos datos, sin un viaje extra.
 */

export type KitchenFilter = "all" | OrderLane;

export const KITCHEN_FILTERS: ReadonlyArray<{
  id: KitchenFilter;
  label: string;
  /** El carril que deja ver, o `null` si no filtra ninguno. */
  lane: OrderLane | null;
}> = [
  { id: "all", label: "Todas", lane: null },
  { id: "entry", label: "Por aceptar", lane: "entry" },
  { id: "preparing", label: "Preparando", lane: "preparing" },
  { id: "ready", label: "Listos", lane: "ready" },
];

/** Lo mínimo que el filtro necesita de un pedido: es presentación, no una regla del pedido. */
export type KitchenFilterableOrder = {
  id: string;
  status: OrderStatus;
  orderNumber: string;
  customerName: string;
  stageChangedAt: string;
};

export type KitchenFilterInput = {
  filter: string;
  search?: string;
  lateOnly?: boolean;
  thresholds?: ComandaThresholdsByLane;
  nowMs?: number;
};

function matchesSearch(order: KitchenFilterableOrder, needle: string): boolean {
  const term = needle.trim().toLowerCase();
  if (!term) return true;

  return (
    order.orderNumber.toLowerCase().includes(term) ||
    order.customerName.toLowerCase().includes(term)
  );
}

/**
 * Los pedidos que se ven con el filtro puesto.
 *
 * Un filtro desconocido **no filtra** (una URL vieja no puede dejar el tablero en blanco) y el filtro de
 * atraso se calcula **en el cliente** a propósito: la urgencia es el tiempo en la etapa **ahora**, y eso
 * cambia entre lecturas —pedírselo al servidor devolvería una foto que ya venció—.
 */
export function filterKitchenOrders<T extends KitchenFilterableOrder>(
  orders: readonly T[],
  input: KitchenFilterInput,
): T[] {
  const lane = KITCHEN_FILTERS.find((option) => option.id === input.filter)?.lane ?? null;
  const nowMs = input.nowMs ?? Date.now();

  return orders.filter((order) => {
    if (lane && resolveOrderLane(order.status) !== lane) return false;
    if (!matchesSearch(order, input.search ?? "")) return false;

    if (input.lateOnly && input.thresholds) {
      const orderLane = resolveOrderLane(order.status);
      if (!orderLane) return false;

      const urgency = resolveComandaUrgency({
        stageChangedAt: order.stageChangedAt,
        nowMs,
        ...thresholdsForLane(input.thresholds, orderLane),
      });

      if (urgency.level !== "late") return false;
    }

    return true;
  });
}
