/**
 * Helpers de la bandeja de órdenes: día del negocio y grupos del turno.
 *
 * Viven fuera de `page.tsx` porque una página de Next no puede exportar nada más que la
 * página (`next build --webpack` falla si no), y esto se prueba solo.
 */

/**
 * Restaurante fijo en Nicaragua (UTC-6, sin DST). Anclamos "hoy" y los rangos a esa zona
 * para que la vista del día sea correcta sin tocar backend.
 *
 * ⚠️ Pendiente conocido: el negocio tiene zona horaria configurable
 * (`BusinessSettings.timezone`), así que esto debería salir de la configuración. Hoy la
 * bandeja del admin usa Managua fija; el checkout y el retiro público sí usan la
 * configuración.
 */
export const ADMIN_ORDERS_TIME_ZONE = "America/Managua";
export const ADMIN_ORDERS_TZ_OFFSET = "-06:00";

/** El día natural (`YYYY-MM-DD`) del negocio para un instante. */
export function managuaDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_ORDERS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
 */
export function orderBucket(
  status: string,
  input?: { pickupTime?: string | null; today?: string },
): OrderBucket {
  const pickupTime = input?.pickupTime;
  const today = input?.today;

  if (pickupTime && today && !CLOSED_STATUSES.has(status)) {
    const pickupMs = new Date(pickupTime).getTime();

    if (!Number.isNaN(pickupMs) && managuaDateString(new Date(pickupMs)) !== today) {
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
