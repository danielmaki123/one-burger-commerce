import type { OrderStatus, OrderStatusHistoryRecord } from "@/modules/orders/domain/order.types";

/**
 * B5 — los sellos de tiempo de un pedido y el promedio de preparación del día.
 *
 * Igual que la búsqueda (`order-search.ts`), la regla vive en el dominio porque **los dos adaptadores
 * tienen que decir lo mismo**: el de Prisma la aplica sobre las filas que trae y el de memoria sobre su
 * historial. Si se copiara, el promedio de la pantalla y el de los tests podrían no ser el mismo número.
 *
 * Un pedido "está listo" cuando entra a `ready` o `ready_for_pickup` (lo que espera al mostrador) y su
 * preparación es lo que tardó **desde que entró hasta ese momento**. Se miran los pedidos que ya
 * llegaron a listo: los que están en el fuego todavía no tienen tiempo de preparación, y contarlos con
 * el reloj de ahora sería inventar un promedio que empeora solo.
 */

/** Estados que significan "ya está listo para entregar". */
export const READY_STATUSES: readonly OrderStatus[] = ["ready", "ready_for_pickup"];

/** Un pedido que ya pasó a `picked_up`/`closed` también pasó por listo antes. */
export const COMPLETED_AFTER_READY_STATUSES: readonly OrderStatus[] = [
  "ready",
  "ready_for_pickup",
  "picked_up",
  "delivered",
  "served",
  "closed",
];

/** El instante en que empezó la etapa actual: el **último** cambio de estado, o la creación. */
export function resolveStageChangedAt(
  history: readonly OrderStatusHistoryRecord[],
  createdAt: string,
): string {
  return history.reduce<string>(
    (latest, entry) => (entry.createdAt > latest ? entry.createdAt : latest),
    createdAt,
  );
}

/**
 * El primer instante en que el pedido quedó listo, o `null` si todavía no lo estuvo.
 *
 * Se toma el **primero** aunque después haya vuelto a moverse: lo que se mide es cuánto tardó la
 * cocina, no cuánto esperó el cliente en el mostrador. Y se exige que el pedido haya llegado a un
 * estado posterior (`picked_up`, `closed`, …) o sea el actual, que ya viene dado por el estado del
 * pedido: acá solo importa el sello.
 */
export function resolveReadyAt(
  history: readonly OrderStatusHistoryRecord[],
): string | null {
  let first: string | null = null;

  for (const entry of history) {
    if (!READY_STATUSES.includes(entry.status)) continue;
    if (first === null || entry.createdAt < first) first = entry.createdAt;
  }

  return first;
}

/** Más de cuatro horas en cocina no es un promedio: es un pedido que quedó abierto por error. */
export const MAX_PREP_MINUTES = 240;

/**
 * El promedio de preparación, en minutos enteros, de los pedidos que ya están listos.
 *
 * `null` cuando todavía no hay ninguno listo: la pantalla lo dice ("todavía sin datos") en vez de
 * mostrar 0 min, que se leería como una cocina instantánea.
 */
export function averagePrepMinutes(
  orders: readonly { createdAt: string; readyAt: string | null }[],
): number | null {
  const durations: number[] = [];

  for (const order of orders) {
    if (!order.readyAt) continue;

    const startedAt = Date.parse(order.createdAt);
    const readyAt = Date.parse(order.readyAt);
    if (Number.isNaN(startedAt) || Number.isNaN(readyAt)) continue;

    const minutes = (readyAt - startedAt) / 60_000;
    if (minutes < 0 || minutes > MAX_PREP_MINUTES) continue;

    durations.push(minutes);
  }

  if (durations.length === 0) return null;

  const total = durations.reduce((sum, minutes) => sum + minutes, 0);

  return Math.round(total / durations.length);
}
