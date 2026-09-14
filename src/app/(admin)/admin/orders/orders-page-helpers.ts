import {
  addDays,
  dateInTimeZone,
  pickupInstant,
} from "@/modules/business-settings/domain/pickup-days";

/**
 * Helpers de la bandeja de órdenes: día del negocio y grupos del turno.
 *
 * Viven fuera de `page.tsx` porque una página de Next no puede exportar nada más que la
 * página (`next build --webpack` falla si no), y esto se prueba solo.
 *
 * **La zona horaria sale de la configuración del negocio** (`BusinessSettings.timezone`),
 * como en el checkout y el retiro público. Antes acá había una `America/Managua` fija con
 * su offset `-06:00` escrito a mano: un negocio en otra zona veía el turno del día
 * equivocado y los rangos de la API no cubrían su día.
 */

/** El día natural (`YYYY-MM-DD`) del negocio para un instante. */
export function businessDate(date: Date, timeZone: string): string {
  return dateInTimeZone(date, timeZone);
}

/**
 * El rango ISO de un día natural del negocio, para `dateFrom`/`dateTo` (los dos inclusive):
 * desde las 00:00 de ese día hasta el último milisegundo antes de la medianoche siguiente.
 */
export function businessDayRange(
  date: string,
  timeZone: string,
): { from: string | undefined; to: string | undefined } {
  const start = pickupInstant({ date, time: "00:00", timeZone });
  const nextStart = pickupInstant({ date: addDays(date, 1), time: "00:00", timeZone });

  // Una fecha inválida devuelve `null`: se deja el filtro abierto en vez de romper la vista.
  if (!start || !nextStart) return { from: undefined, to: undefined };

  return {
    from: start.toISOString(),
    to: new Date(nextStart.getTime() - 1).toISOString(),
  };
}

/** Días que se le restan al día de hoy para los presets de historial. */
export function shiftBusinessDays(date: string, days: number): string {
  return addDays(date, days);
}

/** Buckets de turno, en el orden en que el encargado los atiende. */
export type OrderBucket = "programados" | "nuevas" | "cocina" | "listas" | "otras" | "cerradas";

/** Estados que ya no son trabajo de cocina. */
const CLOSED_STATUSES: ReadonlySet<string> = new Set([
  "closed",
  "cancelled",
  "delivered",
  "picked_up",
  "served",
]);

/**
 * En qué grupo de la bandeja va el pedido.
 *
 * Un pedido abierto para **otro día** no es trabajo de este turno: va aparte, primero, para
 * que la cocina no lo empiece hoy (fase 4 del checkout: el retiro puede ser para cualquier
 * fecha). Sin `pickupTime` o sin `today` se agrupa como siempre, por estado.
 *
 * La `timeZone` es obligatoria: sin ella no se puede saber si el retiro es de otro día, y
 * el grupo caería en silencio al de siempre. El compilador lo exige.
 */
export function orderBucket(
  status: string,
  input?: { pickupTime?: string | null; today?: string; timeZone: string },
): OrderBucket {
  const pickupTime = input?.pickupTime;
  const today = input?.today;
  const timeZone = input?.timeZone;

  if (pickupTime && today && timeZone && !CLOSED_STATUSES.has(status)) {
    const pickupMs = new Date(pickupTime).getTime();

    if (!Number.isNaN(pickupMs) && dateInTimeZone(new Date(pickupMs), timeZone) !== today) {
      return "programados";
    }
  }

  if (status === "new") return "nuevas";
  if (status === "confirmed" || status === "accepted" || status === "preparing") return "cocina";
  if (status === "ready" || status === "ready_for_pickup") return "listas";
  if (CLOSED_STATUSES.has(status)) return "cerradas";
  return "otras";
}

export const BUCKET_META: Record<OrderBucket, { title: string; hint?: string }> = {
  programados: { title: "Programados", hint: "para otro día" },
  nuevas: { title: "Nuevas", hint: "esperan tu confirmación" },
  cocina: { title: "En cocina" },
  listas: { title: "Listas para retiro" },
  otras: { title: "Otras" },
  cerradas: { title: "Cerradas" },
};

export const BUCKET_ORDER: OrderBucket[] = [
  "programados",
  "nuevas",
  "cocina",
  "listas",
  "otras",
  "cerradas",
];

type QueueOrderLike = {
  pickupTime?: string | null;
  createdAt: string;
};

/**
 * B0 — el orden de la cola del turno: **primero lo que se retira antes**.
 *
 * La API devuelve las órdenes por creación descendente, que es lo correcto para el historial, pero en
 * la cola manda la hora prometida: un pedido que entró después y se retira antes no puede quedar
 * debajo de uno comprometido para más tarde. Con la misma hora gana el que entró antes, y un pedido
 * sin hora prometida queda al final: no puede adelantarse a un compromiso con reloj.
 *
 * Devuelve una lista nueva: el orden que llega del servidor no se toca.
 */
export function sortQueueOrders<T extends QueueOrderLike>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const aTime = a.pickupTime ? new Date(a.pickupTime).getTime() : null;
    const bTime = b.pickupTime ? new Date(b.pickupTime).getTime() : null;

    if (aTime !== null && bTime !== null && aTime !== bTime) {
      return aTime - bTime;
    }

    if (aTime !== null && bTime === null) return -1;
    if (aTime === null && bTime !== null) return 1;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * B1 — los pedidos que **aparecieron** desde la lectura anterior.
 *
 * El aviso «N pedidos nuevos» cuenta altas, no el total: comparar contra lo que ya estaba es lo que
 * evita que suene en cada refresco. Que un pedido desaparezca (filtro, historial) no es una novedad.
 * Quien llama decide si hay lectura previa: en la primera carga no hay nada nuevo.
 */
export function findNewOrderIds(
  previousIds: readonly string[],
  incoming: readonly { id: string }[],
): string[] {
  const known = new Set(previousIds);

  return incoming.filter((order) => !known.has(order.id)).map((order) => order.id);
}

/**
 * B1 — hace cuánto se leyó la lista, para que la frescura no mienta.
 *
 * El poll es de segundos, así que los primeros segundos van en segundos; pasado el minuto se resume
 * (nadie necesita «hace 743 s»). Un reloj que va para atrás no muestra tiempos negativos.
 */
export function formatUpdatedAgo(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));

  if (seconds < 5) return "ahora";
  if (seconds < 60) return `hace ${seconds} s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;

  return `hace ${Math.floor(minutes / 60)} h`;
}
