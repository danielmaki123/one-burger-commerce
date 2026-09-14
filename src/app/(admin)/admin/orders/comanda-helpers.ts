import type { OrderStatus } from "@/modules/orders/domain/order.types";

/**
 * B3 — el tablero de comandas: carriles y urgencia.
 *
 * Dos decisiones del owner viven acá, y por eso están en un helper puro y probado:
 *
 * 1. **Cada etapa de cocina tiene su carril.** Por aceptar es solo lo que nadie tomó todavía; en
 *    preparación incluye lo aceptado (ya es trabajo de cocina) y lo que se está cocinando; listas es
 *    lo que espera al mostrador. Un pedido cerrado o cancelado **no está en el tablero**: sigue
 *    existiendo en el historial.
 * 2. **La urgencia se mide dentro de la etapa**, no desde que entró el pedido (§4.3). Los umbrales
 *    entran por parámetro porque en B5 salen de la configuración de cada local.
 */

export type ComandaLane = "pending" | "preparing" | "ready";

export type ComandaLaneMeta = { id: ComandaLane; label: string; empty: string };

/** Los carriles, en el orden en que la cocina los mira. */
export const COMANDA_LANES: readonly ComandaLaneMeta[] = [
  {
    id: "pending",
    label: "Por aceptar",
    empty: "No hay comandas nuevas. Cuando entre un pedido, aparece acá.",
  },
  {
    id: "preparing",
    label: "En preparación",
    empty: "Nada en el fuego. Aceptá una comanda para empezar.",
  },
  {
    id: "ready",
    label: "Listas",
    empty: "Todavía no hay nada listo para entregar.",
  },
];

/** El carril de un estado, o `null` si el pedido ya salió del tablero. */
export function comandaLane(status: OrderStatus): ComandaLane | null {
  if (status === "new") return "pending";
  if (status === "confirmed" || status === "accepted" || status === "preparing") return "preparing";
  if (status === "ready" || status === "ready_for_pickup") return "ready";

  return null;
}

/**
 * Reparte los pedidos en sus carriles conservando el orden que trae la lista (que ya viene con la
 * hora prometida primero, B0) y sin inventar carriles vacíos: los tres existen siempre.
 */
export function groupComandasByLane<T extends { status: OrderStatus }>(
  orders: readonly T[],
): Record<ComandaLane, T[]> {
  const grouped: Record<ComandaLane, T[]> = { pending: [], preparing: [], ready: [] };

  for (const order of orders) {
    const lane = comandaLane(order.status);
    if (lane) grouped[lane].push(order);
  }

  return grouped;
}

/** Los contadores de la barra superior. `total` cuenta solo lo que está en el tablero. */
export function comandaCounters(orders: readonly { status: OrderStatus }[]): {
  pending: number;
  preparing: number;
  ready: number;
  total: number;
} {
  const grouped = groupComandasByLane(orders);

  return {
    pending: grouped.pending.length,
    preparing: grouped.preparing.length,
    ready: grouped.ready.length,
    total: grouped.pending.length + grouped.preparing.length + grouped.ready.length,
  };
}

/** "hace 6 min" · "hace 1 h 5 min". Negativo (reloj que va para atrás) se lee "recién". */
export function formatStageElapsed(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));

  if (safe < 1) return "recién";
  if (safe < 60) return `hace ${safe} min`;

  const hours = Math.floor(safe / 60);
  const rest = safe % 60;

  return rest === 0 ? `hace ${hours} h` : `hace ${hours} h ${rest} min`;
}

/** Umbrales por defecto, en minutos: a los 10 avisa y a los 15 ya está atrasada (§4.3). */
export const DEFAULT_WARNING_MINUTES = 10;
export const DEFAULT_LATE_MINUTES = 15;

export type ComandaUrgencyLevel = "normal" | "warning" | "late";

export type ComandaUrgency = {
  level: ComandaUrgencyLevel;
  minutes: number;
  /** Lo que se muestra en el chip: el color nunca va solo (§4.5). */
  label: string;
};

/**
 * Cuánto hace que la comanda está en su etapa actual y con qué urgencia.
 *
 * Una fecha ilegible no inventa un atraso: devuelve el nivel normal en vez de mandar una comanda al
 * rojo por un dato raro.
 */
export function resolveComandaUrgency({
  stageChangedAt,
  nowMs,
  warningMinutes = DEFAULT_WARNING_MINUTES,
  lateMinutes = DEFAULT_LATE_MINUTES,
}: {
  stageChangedAt: string;
  nowMs: number;
  warningMinutes?: number;
  lateMinutes?: number;
}): ComandaUrgency {
  const startedAt = Date.parse(stageChangedAt);

  if (Number.isNaN(startedAt)) {
    return { level: "normal", minutes: 0, label: formatStageElapsed(0) };
  }

  const minutes = Math.max(0, Math.floor((nowMs - startedAt) / 60_000));
  const level: ComandaUrgencyLevel =
    minutes >= lateMinutes ? "late" : minutes >= warningMinutes ? "warning" : "normal";
  const elapsed = formatStageElapsed(minutes);

  return {
    level,
    minutes,
    label: level === "late" ? `Atrasado ${elapsed}` : elapsed,
  };
}
