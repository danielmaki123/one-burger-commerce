import { dateInTimeZone } from "@/modules/business-settings/domain/pickup-days";

/**
 * El **scheduling del retiro**, dueño `orders`, en un solo lugar.
 *
 * Dos reglas que antes no existían en el dominio y por eso cada pantalla resolvía —o no resolvía— a su
 * manera:
 *
 * 1. **El inicio recomendado** de un pedido programado: `pickupTime − Location.pickupLeadMinutes`. La
 *    referencia aprobada de Cocina lo muestra (`Inicio recomendado 17:35` para un retiro de `18:00`) y la
 *    cocina lo necesita para saber cuándo arrancar. **Prohibido** recalcularlo en cada UI: es la misma
 *    cuenta y tiene que dar el mismo número en todas.
 * 2. **Qué es «programado»**: un retiro para **otro día del negocio** no es trabajo de este turno y va al
 *    grupo *Programados* del carril ENTRADA, para que la cocina no lo empiece hoy.
 *
 * El dominio **no** consulta `locations`: el lead entra por parámetro (lo resuelve el caso de uso, que es
 * quien tiene el repositorio). La autoridad del lead es el **local**; el valor del negocio es sólo el
 * respaldo de un pedido sin local.
 */

/**
 * Respaldo cuando el local no tiene un lead usable. Coincide con el default del esquema
 * (`Location.pickupLeadMinutes @default(25)`) y con el del negocio: un valor inservible no puede dejar a
 * la cocina sin referencia.
 */
export const DEFAULT_PICKUP_LEAD_MINUTES = 25;

/**
 * Un lead usable es un entero ≥ 0. Un valor roto (`0.5`, negativo, `NaN`, `Infinity`) cae al respaldo:
 * truncar `0.5` a `0` haría que la cocina creyera que el pedido se empieza a la hora prometida, que es
 * una decisión distinta de «no sé cuánto antes hay que arrancar».
 */
function usableLeadMinutes(value: number | null | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : DEFAULT_PICKUP_LEAD_MINUTES;
}

/**
 * El instante en que conviene **empezar** el pedido, o `null` si no hay hora prometida.
 *
 * `null` no es un error: la venta de mostrador crea el pedido sin hora (`pickupTime: null`) y la cocina
 * dice «Retiro: lo antes posible». Devolver «ahora» o la hora de creación sería inventar un compromiso
 * que el cliente nunca hizo.
 */
export function resolveRecommendedStart(input: {
  pickupTime?: string | null;
  pickupLeadMinutes?: number | null;
}): string | null {
  if (!input.pickupTime) return null;

  const pickupMs = Date.parse(input.pickupTime);
  if (Number.isNaN(pickupMs)) return null;

  return new Date(pickupMs - usableLeadMinutes(input.pickupLeadMinutes) * 60_000).toISOString();
}

/** Lo mismo, sobre un pedido de la cola (que ya trae los dos campos con esos nombres). */
export function resolveRecommendedStartForOrder(order: {
  pickupTime?: string | null;
  pickupLeadMinutes?: number | null;
}): string | null {
  return resolveRecommendedStart(order);
}

/**
 * ¿El retiro es de **otro día** del negocio?
 *
 * La `timeZone` es obligatoria: sin ella no se puede saber de qué día se habla, y el grupo caería en
 * silencio al de siempre. La zona es la del negocio, no la del navegador.
 */
export function isScheduledForAnotherDay(
  order: { pickupTime?: string | null; pickupScheduled?: boolean },
  context: { today: string; timeZone: string },
): boolean {
  if (!order.pickupTime) return false;

  const pickupMs = Date.parse(order.pickupTime);
  if (Number.isNaN(pickupMs)) return false;

  return dateInTimeZone(new Date(pickupMs), context.timeZone) !== context.today;
}

/**
 * El reparto del carril ENTRADA en sus dos grupos internos: **Ahora** (se puede tomar ya) y
 * **Programados** (comprometido para otro día). Conserva el orden recibido —la cola ya viene ordenada por
 * hora prometida— y no inventa grupos vacíos.
 */
export function groupScheduledOrders<T extends { pickupTime?: string | null; pickupScheduled?: boolean }>(
  orders: readonly T[],
  context: { today: string; timeZone: string },
): { now: T[]; scheduled: T[] } {
  const now: T[] = [];
  const scheduled: T[] = [];

  for (const order of orders) {
    if (isScheduledForAnotherDay(order, context)) scheduled.push(order);
    else now.push(order);
  }

  return { now, scheduled };
}
