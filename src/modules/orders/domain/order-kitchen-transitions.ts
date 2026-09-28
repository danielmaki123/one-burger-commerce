import { OrderError } from "./order-errors";
import { getAllowedNextStatuses, isValidStatusTransition } from "./order-workflows";
import type { OrderStatus, OrderType } from "./order.types";

/**
 * La **capacidad de Cocina**, aplicada en el servidor (`TASK-ORDERS-KITCHEN-RUNTIME-002`).
 *
 * La spec de Cocina es explícita ([`kitchen.md`](../../../../ops/design/screens/kitchen.md) § *Flujo
 * objetivo*): la cocina opera **sólo** estos tres pasos y ninguno más, y **termina en Listo**.
 *
 * ```text
 * new → confirmed          (aceptar)
 * confirmed → preparing    (iniciar preparación)
 * preparing → ready_for_pickup   (terminar · LISTO)
 * ```
 *
 * **Esto no es un segundo workflow.** El workflow único sigue siendo `order-workflows.ts`: acá se declara
 * la **lista blanca de la capacidad** —qué parte de ese flujo puede tocar esta superficie—. Las dos
 * reglas se componen: una transición sólo pasa si el workflow la permite **y** está en la lista blanca.
 * Por eso la tabla de mesa usa sus equivalentes (`accepted`/`served`) y delivery queda afuera: es la
 * misma capacidad, expresada en el vocabulario de cada tipo de pedido.
 *
 * Sin esta puerta, `kitchen` podía llegar a la retirada y al cierre desde la ruta de estado (la puerta
 * gruesa `canManageOrderOperations` lo incluye): eso es del **mostrador**.
 */

export type KitchenTransition = { from: OrderStatus; to: OrderStatus };

/**
 * Las transiciones de la capacidad, por tipo de pedido, con los equivalentes que el esquema tiene.
 *
 * `cancelled` (rechazar) no está acá a propósito: no es una transición de avance, tiene su propio camino
 * con motivo obligatorio y se resuelve sin esta puerta.
 */
const KITCHEN_TRANSITIONS_BY_TYPE: Record<OrderType, readonly KitchenTransition[]> = {
  pickup: [
    { from: "new", to: "confirmed" },
    { from: "confirmed", to: "preparing" },
    { from: "preparing", to: "ready_for_pickup" },
  ],
  table: [
    { from: "new", to: "accepted" },
    { from: "accepted", to: "preparing" },
    { from: "preparing", to: "served" },
  ],
  // Delivery está fuera del MVP y su paso final (`out_for_delivery`) no es de cocina: no se declara
  // capacidad acá y la puerta rechaza cualquier avance de esa superficie.
  delivery: [],
};

/** Las transiciones de Cocina del **retiro**, que es el flujo del MVP. Espejo de la spec. */
export const KITCHEN_STATUS_TRANSITIONS: readonly KitchenTransition[] =
  KITCHEN_TRANSITIONS_BY_TYPE.pickup;

/** El estado en el que **termina** Cocina: después de eso, el pedido es del mostrador. */
export const KITCHEN_TERMINAL_STATUS: OrderStatus = "ready_for_pickup";

/**
 * Si el flujo del **MVP** (retiro) puede llegar a ese estado por la capacidad de Cocina.
 *
 * Es una pregunta sobre la capacidad en la superficie que existe hoy, no sobre un pedido concreto:
 * `ready_for_pickup` es alcanzable y `picked_up` no. La tabla del carril de mesa es su **equivalente**
 * (`accepted`/`served`), no una capacidad distinta: por eso no se cuenta acá, o `served` haría parecer
 * alcanzable un estado (`picked_up`) que no lo es.
 */
export function canKitchenReachStatus(status: OrderStatus): boolean {
  return KITCHEN_TRANSITIONS_BY_TYPE.pickup.some((transition) => transition.to === status);
}

/**
 * Si la comanda todavía se puede **rechazar** desde cocina.
 *
 * Rechazar no es un paso del flujo de preparación —tiene su propio camino, con motivo obligatorio— pero
 * es una decisión **de la comanda**: en la spec, `Rechazar` vive en la tarjeta de ENTRADA. La pregunta no
 * se contesta con una lista propia sino con el workflow único: si el pedido admite `cancelled`, la
 * comanda puede rechazarlo. Así no se puede rechazar algo ya retirado o cerrado.
 */
export function canKitchenRejectOrder(input: {
  type: OrderType;
  current: OrderStatus;
}): boolean {
  return getAllowedNextStatuses(input.type, input.current).includes("cancelled");
}

/**
 * La puerta de la capacidad de Cocina. Tira `OrderError` **403** cuando la transición no es de esta
 * superficie.
 *
 * 403 y no 404: la comanda existe y el usuario la ve —su alcance se comprueba aparte—; lo que le falta es
 * la **capacidad**. Y el mensaje distingue los dos motivos, porque son distintos para quien lo lee: «el
 * flujo no lo permite» (se equivocó de botón o llegó tarde) contra «no es tuyo» (es del mostrador).
 */
export function assertKitchenStatusTransition(input: {
  type: OrderType;
  current: OrderStatus;
  next: OrderStatus;
}): void {
  if (input.next === "cancelled") {
    if (canKitchenRejectOrder(input)) return;

    throw new OrderError(
      403,
      "FORBIDDEN",
      `Un pedido en ${input.current} ya no se puede rechazar.`,
    );
  }

  const announced = KITCHEN_TRANSITIONS_BY_TYPE[input.type] ?? [];
  const allowed = announced.some(
    (transition) => transition.from === input.current && transition.to === input.next,
  );

  if (allowed) return;

  // Es una transición del flujo pero **no** de la cocina: la firma otra superficie del pedido (el
  // mostrador para la retirada y el cierre; el flujo de entrega, que está fuera del MVP, para el resto).
  if (isValidStatusTransition(input.type, input.current, input.next)) {
    throw new OrderError(
      403,
      "FORBIDDEN",
      `La transición de ${input.current} a ${input.next} no es una transición de cocina: la firma el mostrador.`,
    );
  }

  throw new OrderError(
    403,
    "FORBIDDEN",
    `La transición de ${input.current} a ${input.next} no es una transición de cocina.`,
  );
}
