import type { OrderStatus } from "@/modules/orders/domain/order.types";

import { filterOrdersForKitchenTab } from "./kitchen-tabs";

/** Lo mínimo que el tablero necesita para clasificar: los mismos campos que ya trae la lista. */
export type BoardViewOrder = {
  id: string;
  status: OrderStatus;
  stageChangedAt: string;
};

/**
 * Punto 3 del roadmap (2026-09-18) — el trabajo del turno, con o sin **modo cocina**.
 *
 * Sin el modo, el tablero ya recibió exactamente lo que tiene que mostrar (la pantalla resolvió los
 * programados para otro día y el filtro de atrasados). Con el modo, además manda el tab elegido:
 * las cinco preguntas de la cocina filtran sobre lo que la pantalla ya tiene —misma API, mismos
 * datos— y el tab desconocido no filtra nada, para que una URL vieja no deje el tablero vacío.
 */
export function filterOrdersForBoardView<T extends BoardViewOrder>(
  orders: readonly T[],
  input: { kitchenMode: boolean; kitchenTab: string; nowMs?: number },
): T[] {
  if (!input.kitchenMode) return [...orders];

  return filterOrdersForKitchenTab(orders, input.kitchenTab, input.nowMs ?? Date.now());
}
