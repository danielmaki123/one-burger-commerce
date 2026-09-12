import {
  formatSlotLabel,
  parseTimeOfDay,
  PICKUP_SLOT_MINUTES,
  type PickupSlot,
  type PickupSlotsResult,
} from "@/modules/business-settings/domain/pickup-slots";
import {
  WEEKDAY_KEYS,
  type BusinessHours,
  type WeekdayKey,
} from "@/modules/business-settings/domain/business-settings.types";

/**
 * Días futuros del retiro (fase 4 del checkout, decisión D1).
 *
 * El cliente puede pedir para **cualquier día**, sin tope: el único límite es el
 * horario de ese día. Por eso todo acá trabaja con el **día natural del negocio**
 * (`YYYY-MM-DD` en su zona horaria) y no con el reloj del celular: un cliente de viaje
 * tiene que ver el día que ve la cocina.
 *
 * Nada de esto es dato del negocio: los horarios salen de `BusinessHours` (config o
 * local) y la zona, de la configuración.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatDateParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Partes de un `YYYY-MM-DD`. `null` si no es una fecha con forma de fecha. */
function parseDate(value: string): { year: number; month: number; day: number } | null {
  if (!DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Rechaza un 31 de febrero: la fecha tiene que existir de verdad.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  return { year, month, day };
}

/** El día natural (`YYYY-MM-DD`) que es "ahora" en la zona del negocio. */
export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

/** Suma (o resta) días a un día natural. */
export function addDays(date: string, days: number): string {
  const parsed = parseDate(date);
  if (!parsed) return date;

  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));

  return formatDateParts(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

/** Qué día de la semana es un día natural. */
export function weekdayOfDate(date: string): WeekdayKey {
  const parsed = parseDate(date);
  if (!parsed) return WEEKDAY_KEYS[0];

  // El día natural es el mismo en cualquier zona: se lee en UTC para no correrse un día.
  const index = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();

  // `getUTCDay()` devuelve 0 para domingo y `WEEKDAY_KEYS` empieza en lunes.
  return WEEKDAY_KEYS[(index + 6) % 7];
}

function offsetMilliseconds(date: Date, timeZone: string): number {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  if (offset === "GMT") return 0;

  const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const [, sign, hours, minutes] = match;
  const magnitude = (Number(hours) * 60 + Number(minutes)) * 60_000;

  return sign === "+" ? magnitude : -magnitude;
}

/**
 * El instante UTC de una hora del negocio en un día concreto.
 *
 * Se resuelve con el desfase que la zona tiene **ese** día (no el de hoy), así el día
 * que cambia el horario de verano no corre la hora. Con zona o fecha inválida devuelve
 * `null`, para que el llamador lo trate como "falta elegir".
 */
export function pickupInstant(input: {
  date: string;
  time: string;
  timeZone: string;
}): Date | null {
  const parsed = parseDate(input.date);
  const minutes = parseTimeOfDay(input.time);
  if (!parsed || minutes === null) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const wallClockAsUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day, hours, rest);

  let zone: string;
  try {
    // Valida la zona: una inválida cae a UTC más abajo.
    new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone });
    zone = input.timeZone;
  } catch {
    zone = "UTC";
  }

  // Dos pasadas: el desfase del candidato puede ser distinto del que se usó para
  // calcularlo (el día del cambio de hora), así que se resuelve una vez más.
  const firstOffset = offsetMilliseconds(new Date(wallClockAsUtc), zone);
  const candidate = new Date(wallClockAsUtc - firstOffset);
  const resolvedOffset = offsetMilliseconds(candidate, zone);

  return new Date(wallClockAsUtc - resolvedOffset);
}

/**
 * El día del retiro cuando es **posterior a hoy**: `mañana`, `viernes 18 de septiembre`.
 *
 * Cadena vacía cuando el retiro es hoy (el texto queda igual que siempre: "Retiro 8:00
 * p. m.") o cuando ya pasó: un pedido viejo tiene su fecha en la pantalla y repetirla en el
 * estimado solo alarga la línea.
 */
export function pickupDayLabel(input: {
  pickupTime: string;
  nowMs: number;
  timeZone: string;
}): string {
  const pickupMs = new Date(input.pickupTime).getTime();
  if (Number.isNaN(pickupMs)) return "";

  const pickupDay = dateInTimeZone(new Date(pickupMs), input.timeZone);
  const today = dateInTimeZone(new Date(input.nowMs), input.timeZone);
  // Los días naturales en `YYYY-MM-DD` se comparan como texto.
  if (pickupDay <= today) return "";

  const label = formatPickupDayLabel({ date: pickupDay, today });

  // "Mañana" va en medio de la frase, así que se escribe en minúscula.
  return label === "Mañana" ? "mañana" : label;
}

/**
 * El horario del día elegido, corto, para el checkout: `de 12:00 a 22:00`.
 *
 * `null` cuando ese día no se atiende: el motivo lo explica el control con su propio
 * mensaje, así que acá no se inventa un texto.
 */
export function formatDayHours(businessHours: BusinessHours, date: string): string | null {
  const day = businessHours[weekdayOfDate(date)];
  if (!day || day.closed) return null;

  const open = parseTimeOfDay(day.open);
  const close = parseTimeOfDay(day.close);
  if (open === null || close === null || close <= open) return null;

  return `de ${day.open} a ${day.close}`;
}

/** Etiqueta del día para el selector: `Hoy`, `Mañana` o `viernes 18 de septiembre`. */export function formatPickupDayLabel(input: { date: string; today: string }): string {
  if (input.date === input.today) return "Hoy";
  if (input.date === addDays(input.today, 1)) return "Mañana";

  const parsed = parseDate(input.date);
  if (!parsed) return input.date;

  // `timeZone: "UTC"`: las partes ya son el día natural, así que formatearlas sin zona
  // las leería con la zona del celular y un cliente en UTC-6 vería el día anterior.
  const parts = new Intl.DateTimeFormat("es-NI", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).formatToParts(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));

  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${weekday} ${day} de ${month}`.trim();
}

/**
 * Turnos de un día elegido, futuro o no.
 *
 * Diferencia clave con `buildPickupSlots` (hoy): acá **no hay "ahora"**. El día entero
 * está disponible desde la apertura, sin sumarle la espera de preparación —esa espera
 * empuja los turnos de hoy, no los de la semana que viene— y sin tope de cantidad, para
 * que un local que abre 10 horas ofrezca sus 20 turnos y no los primeros 5.
 *
 * Ningún turno lleva `isSoonest`: "lo antes posible" es una opción de hoy, no de otro día.
 */
export function buildPickupSlotsForDay(input: {
  businessHours: BusinessHours;
  date: string;
  slotMinutes?: number;
  maxSlots?: number;
}): PickupSlotsResult {
  const day = input.businessHours[weekdayOfDate(input.date)];

  if (!day || day.closed) {
    return { available: false, reason: "closed" };
  }

  const open = parseTimeOfDay(day.open);
  const close = parseTimeOfDay(day.close);

  if (open === null || close === null || close <= open) {
    return { available: false, reason: "closed" };
  }

  const slotMinutes = Math.max(1, Math.trunc(input.slotMinutes ?? PICKUP_SLOT_MINUTES));
  const maxSlots =
    input.maxSlots === undefined ? Number.POSITIVE_INFINITY : Math.max(1, Math.trunc(input.maxSlots));

  const slots: PickupSlot[] = [];
  for (let cursor = open; cursor < close && slots.length < maxSlots; cursor += slotMinutes) {
    const hours = Math.floor(cursor / 60);
    const minutes = cursor % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

    slots.push({ value, label: formatSlotLabel(value), isSoonest: false });
  }

  if (slots.length === 0) {
    return { available: false, reason: "no-slots-left" };
  }

  return { available: true, slots };
}
