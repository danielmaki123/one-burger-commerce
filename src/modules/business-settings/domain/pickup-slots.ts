import { getWeekdayInTimeZone } from "@/modules/business-settings/domain/business-hours-format";
import { TIME_OF_DAY_PATTERN } from "@/modules/business-settings/domain/business-settings.types";
import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

/**
 * Turnos de retiro derivados de la configuración del negocio.
 *
 * Antes esta lista estaba escrita a mano en el checkout (`19:30`, `20:00`, `20:30`,
 * `21:00`) y la opción "lo antes posible" en realidad mandaba las 19:30 fijas. Acá
 * los turnos salen de `businessHours` + `pickupLeadMinutes`, así que un negocio que
 * abre a otra hora o cierra otro día no necesita tocar código.
 */

/** Cada cuántos minutos se ofrece un turno. */
export const PICKUP_SLOT_MINUTES = 30;

/** Cuántos turnos se ofrecen como máximo (los más próximos primero). */
export const MAX_PICKUP_SLOTS = 5;

/** La opción "lo antes posible" es el primer turno, no una hora aparte. */
export type PickupSlot = {
  /** Hora en `HH:mm`, en la zona horaria del negocio. */
  value: string;
  /** Etiqueta en 12 horas lista para mostrar: `7:30 p. m.`. */
  label: string;
  /** Solo el primero: es el que corresponde a "lo antes posible". */
  isSoonest: boolean;
};

export type PickupSlotsResult =
  | { available: true; slots: PickupSlot[] }
  | {
      available: false;
      /** `closed`: hoy no abre. `no-slots-left`: abre, pero ya no llega el tiempo. */
      reason: "closed" | "no-slots-left";
    };

/** `19:30` → 1170 minutos desde la medianoche. `null` si no es una hora válida. */
export function parseTimeOfDay(value: string): number | null {
  if (!TIME_OF_DAY_PATTERN.test(value)) return null;

  const [hours, minutes] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function toTimeOfDay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * Minutos transcurridos desde la medianoche **en la zona del negocio**, que es la
 * que decide si el local está abierto. Una zona inválida cae a UTC en vez de romper
 * el checkout.
 */
export function minutesOfDayInTimeZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const hours = Number(parts.find((part) => part.type === "hour")?.value ?? "");
    const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? "");

    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return hours * 60 + minutes;
    }
  } catch {
    // Zona horaria inválida: se sigue con UTC.
  }

  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/** `19:30` → `7:30 p. m.` */
export function formatSlotLabel(value: string): string {
  const minutes = parseTimeOfDay(value) ?? 0;
  const hours24 = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const suffix = hours24 < 12 ? "a. m." : "p. m.";

  return `${hours12}:${String(rest).padStart(2, "0")} ${suffix}`;
}

/** Paso del respaldo "lo antes posible" cuando no hay turnos de la grilla del día. */
export const SOONEST_PICKUP_STEP_MINUTES = 5;

/**
 * Fin del rango de preparación (T5).
 *
 * El negocio puede configurar un máximo además del mínimo: el cliente no espera
 * "un instante exacto" que la cocina puede fallar, sino una franja. La hora que se
 * **guarda** sigue siendo el mínimo; esto es copy para el cliente.
 *
 * `null` cuando no hay máximo configurado o cuando no agrega tiempo real.
 */
export function pickupRangeEnd(input: {
  /** Hora mínima en `HH:mm` (lo que se guarda como hora de retiro). */
  pickupTime: string;
  pickupLeadMinutes: number;
  pickupMaxMinutes: number | null | undefined;
}): string | null {
  const start = parseTimeOfDay(input.pickupTime);
  if (start === null || input.pickupMaxMinutes === null || input.pickupMaxMinutes === undefined) {
    return null;
  }

  const extra = Math.trunc(input.pickupMaxMinutes) - Math.trunc(input.pickupLeadMinutes);
  if (extra <= 0) return null;

  // El rango puede cruzar la medianoche (un local que cierra tarde).
  return toTimeOfDay((start + extra) % (24 * 60));
}

/**
 * Copy del retiro: `listo entre 1:40 p. m. y 2:00 p. m.` con máximo configurado,
 * o `listo ~1:40 p. m.` sin él.
 */
export function formatPickupRangeLabel(input: {
  pickupTime: string;
  pickupLeadMinutes: number;
  pickupMaxMinutes: number | null | undefined;
}): string {
  const start = formatSlotLabel(input.pickupTime);
  const end = pickupRangeEnd(input);

  return end === null
    ? `listo ~${start}`
    : `listo entre ${start} y ${formatSlotLabel(end)}`;
}

/**
 * "Lo antes posible" cuando el local está cerrado o ya no quedan turnos del día.
 *
 * El checkout nunca bloquea un pedido por horario (eso es una decisión de producto
 * aparte: ver `ops/tasks/TASK-checkout-ux.md` §7), así que necesita *alguna* hora
 * válida que enviar. Se calcula, no se inventa: ahora + tiempo de preparación,
 * redondeado hacia arriba.
 */
export function soonestPickupTime(input: {
  now: Date;
  timezone: string;
  pickupLeadMinutes: number;
  stepMinutes?: number;
}): string {
  const step = Math.max(1, Math.trunc(input.stepMinutes ?? SOONEST_PICKUP_STEP_MINUTES));
  const minutes = minutesOfDayInTimeZone(input.now, input.timezone);
  const target = minutes + Math.max(0, input.pickupLeadMinutes);
  const rounded = Math.ceil(target / step) * step;
  // Se recorta al último punto del día que cae en la grilla (23:55 con paso de 5).
  const endOfDay = Math.floor((24 * 60 - 1) / step) * step;

  return toTimeOfDay(Math.min(rounded, endOfDay));
}

export function buildPickupSlots(input: {
  businessHours: BusinessHours;
  timezone: string;
  pickupLeadMinutes: number;
  now: Date;
  slotMinutes?: number;
  maxSlots?: number;
}): PickupSlotsResult {
  const today = input.businessHours[getWeekdayInTimeZone(input.now, input.timezone)];

  if (!today || today.closed) {
    return { available: false, reason: "closed" };
  }

  const open = parseTimeOfDay(today.open);
  const close = parseTimeOfDay(today.close);

  // Un horario incoherente (o que cruza la medianoche) se trata como cerrado en vez
  // de ofrecer turnos inventados.
  if (open === null || close === null || close <= open) {
    return { available: false, reason: "closed" };
  }

  const slotMinutes = Math.max(1, Math.trunc(input.slotMinutes ?? PICKUP_SLOT_MINUTES));
  const maxSlots = Math.max(1, Math.trunc(input.maxSlots ?? MAX_PICKUP_SLOTS));
  const nowMinutes = minutesOfDayInTimeZone(input.now, input.timezone);
  const earliest = Math.max(open, nowMinutes + Math.max(0, input.pickupLeadMinutes));

  // Los turnos se alinean con la apertura, no con una grilla absoluta: si el local
  // abre a las 12:15, los turnos son 12:15, 12:45, …
  const steps = Math.ceil((earliest - open) / slotMinutes);
  let cursor = open + steps * slotMinutes;

  const slots: PickupSlot[] = [];
  while (cursor < close && slots.length < maxSlots) {
    const value = toTimeOfDay(cursor);
    slots.push({ value, label: formatSlotLabel(value), isSoonest: slots.length === 0 });
    cursor += slotMinutes;
  }

  if (slots.length === 0) {
    return { available: false, reason: "no-slots-left" };
  }

  return { available: true, slots };
}
