import { WEEKDAY_KEYS } from "@/modules/business-settings/domain/business-settings.types";
import type {
  BusinessHours,
  WeekdayKey,
} from "@/modules/business-settings/domain/business-settings.types";

export const WEEKDAY_SHORT_LABELS: Record<WeekdayKey, string> = {
  mon: "Lun",
  tue: "Mar",
  wed: "Mié",
  thu: "Jue",
  fri: "Vie",
  sat: "Sáb",
  sun: "Dom",
};

const WEEKDAY_FROM_ENGLISH: Record<string, WeekdayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

function dayKey(hours: BusinessHours[WeekdayKey]): string {
  return hours.closed ? "closed" : `${hours.open}-${hours.close}`;
}

function describeDay(hours: BusinessHours[WeekdayKey]): string {
  return hours.closed ? "cerrado" : `${hours.open} - ${hours.close}`;
}

/**
 * Resumen legible de la semana: agrupa días contiguos con el mismo horario.
 *
 * `12:00 - 22:00` de lunes a domingo se ve como `Lun - Dom 12:00 - 22:00`.
 */
export function formatBusinessHoursSummary(hours: BusinessHours): string {
  const groups: { from: WeekdayKey; to: WeekdayKey; value: string }[] = [];

  for (const weekday of WEEKDAY_KEYS) {
    const value = dayKey(hours[weekday]);
    const last = groups[groups.length - 1];

    if (last && last.value === value) {
      last.to = weekday;
      continue;
    }

    groups.push({ from: weekday, to: weekday, value });
  }

  return groups
    .map((group) => {
      const from = WEEKDAY_SHORT_LABELS[group.from];
      const to = WEEKDAY_SHORT_LABELS[group.to];
      const label = group.from === group.to ? from : `${from} - ${to}`;
      return `${label} ${describeDay(hours[group.from])}`;
    })
    .join(" · ");
}

/** Día de la semana que corresponde a `date` en la zona horaria del negocio. */
export function getWeekdayInTimeZone(date: Date, timeZone: string): WeekdayKey {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(date);

    const weekday = WEEKDAY_FROM_ENGLISH[formatted];
    if (weekday) return weekday;
  } catch {
    // Una zona horaria inválida no debería tumbar el sitio: se cae al día UTC.
  }

  return weekdayFromUtc(date);
}

function weekdayFromUtc(date: Date): WeekdayKey {
  // getUTCDay(): 0 = domingo; WEEKDAY_KEYS arranca en lunes.
  return WEEKDAY_KEYS[(date.getUTCDay() + 6) % 7];
}

/** Texto corto del horario de hoy, para el checkout: `hoy de 12:00 a 22:00`. */
export function formatTodayHours(hours: BusinessHours, date: Date, timeZone: string): string {
  const today = hours[getWeekdayInTimeZone(date, timeZone)];

  if (!today || today.closed) return "hoy cerrado";

  return `hoy de ${today.open} a ${today.close}`;
}
