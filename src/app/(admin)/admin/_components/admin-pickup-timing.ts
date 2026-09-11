/**
 * Semáforo de la bandeja de órdenes.
 *
 * El reloj es **la hora de retiro prometida**, no la antigüedad del pedido. La versión
 * anterior pintaba de rojo cualquier pedido abierto hace más de 20 minutos: un pedido
 * programado para las 21:00 aparecía en rojo a las 19:20, con una hora de margen
 * todavía. Un aviso que grita cuando no pasa nada deja de significar algo.
 */

/** A partir de cuántos minutos de atraso el pedido pasa de naranja a rojo. */
export const ADMIN_PICKUP_LATE_GRACE_MINUTES = 15;

const CLOSED_STATUSES: ReadonlySet<string> = new Set([
  "closed",
  "cancelled",
  "picked_up",
  "delivered",
  "served",
]);

export type AdminPickupTimingState = "on-time" | "past" | "late" | "done" | "unknown";

export type AdminPickupTiming = {
  state: AdminPickupTimingState;
  /** Minutos que faltan (positivo) o que se pasaron (negativo). `null` si no hay hora. */
  minutesFromDue: number | null;
  /** Texto corto para la fila: `en 12 min`, `ahora`, `hace 5 min`. */
  deltaLabel: string;
};

export function resolveAdminPickupTiming(input: {
  pickupTime: string | null | undefined;
  status: string;
  nowMs: number;
}): AdminPickupTiming {
  if (CLOSED_STATUSES.has(input.status)) {
    return { state: "done", minutesFromDue: null, deltaLabel: "" };
  }

  if (!input.pickupTime) {
    return { state: "unknown", minutesFromDue: null, deltaLabel: "" };
  }

  const dueMs = new Date(input.pickupTime).getTime();
  if (Number.isNaN(dueMs)) {
    return { state: "unknown", minutesFromDue: null, deltaLabel: "" };
  }

  const diffMs = dueMs - input.nowMs;
  const minutes = Math.round(Math.abs(diffMs) / 60_000);

  if (diffMs >= 0) {
    return {
      state: "on-time",
      minutesFromDue: minutes,
      deltaLabel: minutes < 1 ? "ahora" : `en ${minutes} min`,
    };
  }

  return {
    state: minutes >= ADMIN_PICKUP_LATE_GRACE_MINUTES ? "late" : "past",
    minutesFromDue: -minutes,
    deltaLabel: minutes < 1 ? "ahora" : `hace ${minutes} min`,
  };
}
