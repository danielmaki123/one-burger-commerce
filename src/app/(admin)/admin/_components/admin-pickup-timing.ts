import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import {
  dateInTimeZone,
  pickupDayLabel,
} from "@/modules/business-settings/domain/pickup-days";

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
  /**
   * Zona del negocio. Con ella, un retiro de **otro día** no lleva cuenta regresiva: el
   * semáforo es contra la hora prometida de hoy, y "en 1440 min" no le dice nada a nadie.
   */
  timeZone?: string;
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

  if (input.timeZone) {
    const dueDay = dateInTimeZone(new Date(dueMs), input.timeZone);
    const today = dateInTimeZone(new Date(input.nowMs), input.timeZone);

    if (dueDay !== today) {
      return { state: "unknown", minutesFromDue: null, deltaLabel: "" };
    }
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

/**
 * Cómo se lee el retiro en el admin: la hora, el día cuando no es hoy y si el cliente lo
 * programó.
 *
 * La distinción importa en cocina: no es lo mismo un pedido que hay que empezar ya, uno
 * que el cliente viene a buscar en dos horas, o uno de mañana —sin el día, un pedido
 * programado para mañana se leería como uno de hoy y se empezaría a cocinar.
 */
export function describeAdminPickup(input: {
  pickupTime: string | null | undefined;
  pickupScheduled?: boolean;
  timeZone: string;
  /** Para saber si el retiro es hoy. Sin él no se agrega el día (comportamiento previo). */
  nowMs?: number;
}): string | null {
  if (!input.pickupTime) return null;

  const time = formatTimeInTimeZone(input.pickupTime, input.timeZone);
  if (!time) return null;

  const pickupMs = new Date(input.pickupTime).getTime();
  let day = "";

  if (input.nowMs !== undefined && !Number.isNaN(pickupMs)) {
    const label = pickupDayLabel({
      pickupTime: input.pickupTime,
      nowMs: input.nowMs,
      timeZone: input.timeZone,
    });

    if (label) day = `${label} `;
  }

  return input.pickupScheduled
    ? `Retiro ${day}${time} · Programado`
    : `Retiro ${day}~${time} · Lo antes posible`;
}
