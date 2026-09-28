import type { OrderStatus, OrderStatusHistoryRecord } from "@/modules/orders/domain/order.types";

/**
 * B5 — los sellos de tiempo de un pedido y el promedio de preparación del día.
 *
 * Igual que la búsqueda (`order-search.ts`), la regla vive en el dominio porque **los dos adaptadores
 * tienen que decir lo mismo**: el de Prisma la aplica sobre las filas que trae y el de memoria sobre su
 * historial. Si se copiara, el promedio de la pantalla y el de los tests podrían no ser el mismo número.
 *
 * **Preparación real (`TASK-ORDERS-KITCHEN-RUNTIME-002`)**: lo que tardó la cocina es
 * **`preparingAt` → `readyAt`**, no `createdAt → readyAt`. Un pedido que nadie empezó a preparar **no
 * tiene tiempo de preparación** y **no entra** al promedio: contarlo desde la creación —lo que se hacía
 * antes (`:78`)— inventa un número que la cocina no hizo y mezcla la espera del cliente con el trabajo.
 * Se miran los pedidos que ya llegaron a listo: los que están en el fuego todavía no tienen tiempo.
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
 * El primer instante en que el pedido entró en uno de esos estados, o `null` si nunca lo hizo.
 *
 * Se toma el **primero**: lo que se mide es cuánto tardó una etapa, no cuánto se demoró después. Y se
 * exige que el pedido lo haya alcanzado de verdad: sin fila en el historial no hay sello, y **no** se
 * sustituye por la creación del pedido (ese es justamente el bug que esta función cierra).
 */
function resolveFirstStatusAt(
  history: readonly OrderStatusHistoryRecord[],
  statuses: readonly OrderStatus[],
): string | null {
  let first: string | null = null;

  for (const entry of history) {
    if (!statuses.includes(entry.status)) continue;
    if (first === null || entry.createdAt < first) first = entry.createdAt;
  }

  return first;
}

/** El primer instante en que el pedido quedó listo, o `null` si todavía no lo estuvo. */
export function resolveReadyAt(history: readonly OrderStatusHistoryRecord[]): string | null {
  return resolveFirstStatusAt(history, READY_STATUSES);
}

/**
 * El primer instante en que la cocina **empezó a preparar** el pedido, o `null` si nunca lo hizo.
 *
 * Es el sello del que sale la preparación real. Un pedido aceptado y todavía sin empezar no tiene
 * `preparingAt`: la pantalla lo dice («espera inicio») en vez de mostrar un cronómetro que nadie arrancó.
 */
export function resolvePreparingAt(history: readonly OrderStatusHistoryRecord[]): string | null {
  return resolveFirstStatusAt(history, ["preparing"]);
}

/**
 * Los cinco sellos de etapa del pedido, derivados del historial en **una** pasada.
 *
 * `null` significa «esa etapa no pasó» — no «no se sabe»: es la diferencia entre un pedido que todavía
 * está en el fuego y uno que ya se retiró. El historial puede venir en cualquier orden (los adaptadores
 * no garantizan uno), así que cada sello es el **mínimo** de su estado.
 */
export type OrderStageTimes = {
  confirmedAt: string | null;
  preparingAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  closedAt: string | null;
};

export function resolveOrderStageTimes(
  history: readonly OrderStatusHistoryRecord[],
): OrderStageTimes {
  return {
    // `accepted` es el equivalente de mesa de `confirmed`: mismo hito, otro nombre.
    confirmedAt: resolveFirstStatusAt(history, ["confirmed", "accepted"]),
    preparingAt: resolvePreparingAt(history),
    readyAt: resolveReadyAt(history),
    pickedUpAt: resolveFirstStatusAt(history, ["picked_up"]),
    closedAt: resolveFirstStatusAt(history, ["closed"]),
  };
}

/** Más de cuatro horas en cocina no es un promedio: es un pedido que quedó abierto por error. */
export const MAX_PREP_MINUTES = 240;

/** Lo mínimo que hace falta para medir una preparación: cuándo empezó y cuándo terminó. */
type PrepTiming = { preparingAt: string | null; readyAt: string | null };

/**
 * La preparación real de un pedido, en minutos, o `null` si no se puede medir.
 *
 * Devuelve `null` —y no 0— cuando falta el sello de inicio, cuando el sello es imposible (listo antes de
 * empezar) o cuando pasa el techo: quien llama decide qué decir, y ninguno de esos casos es «preparación
 * instantánea».
 */
function prepMinutesOf(order: PrepTiming): number | null {
  if (!order.preparingAt || !order.readyAt) return null;

  const startedAt = Date.parse(order.preparingAt);
  const readyAt = Date.parse(order.readyAt);
  if (Number.isNaN(startedAt) || Number.isNaN(readyAt)) return null;

  const minutes = (readyAt - startedAt) / 60_000;
  if (minutes < 0 || minutes > MAX_PREP_MINUTES) return null;

  return minutes;
}

/** Todas las preparaciones medibles de un conjunto de pedidos. */
function measuredPrepMinutes(orders: readonly PrepTiming[]): number[] {
  const durations: number[] = [];

  for (const order of orders) {
    const minutes = prepMinutesOf(order);
    if (minutes !== null) durations.push(minutes);
  }

  return durations;
}

/**
 * El promedio de preparación, en minutos enteros, de los pedidos que ya están listos.
 *
 * `null` cuando todavía no hay ninguno con preparación **medida**: la pantalla lo dice ("todavía sin
 * datos") en vez de mostrar 0 min, que se leería como una cocina instantánea.
 */
export function averagePrepMinutes(orders: readonly PrepTiming[]): number | null {
  const durations = measuredPrepMinutes(orders);

  if (durations.length === 0) return null;

  const total = durations.reduce((sum, minutes) => sum + minutes, 0);

  return Math.round(total / durations.length);
}

/**
 * La preparación **más larga** del conjunto, en minutos enteros, o `null` si ninguna es medible.
 *
 * Es el tercer número de la cabecera de Cocina (`Más larga 24 min` en la referencia aprobada). Sale de
 * la misma medición que el promedio: se trunca al minuto, porque la pantalla no muestra segundos.
 */
export function resolveLongestPrepMinutes(orders: readonly PrepTiming[]): number | null {
  const durations = measuredPrepMinutes(orders);

  if (durations.length === 0) return null;

  return Math.floor(Math.max(...durations));
}
