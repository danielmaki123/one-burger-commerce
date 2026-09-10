import {
  cloneBusinessHours,
  DEFAULT_BUSINESS_HOURS,
} from "@/modules/business-settings/domain/business-settings-defaults";
import {
  TIME_OF_DAY_PATTERN,
  WEEKDAY_KEYS,
  type BusinessHours,
  type BusinessHoursDay,
  type BusinessHoursPatch,
} from "@/modules/business-settings/domain/business-settings.types";

function isBusinessHoursDay(value: unknown): value is BusinessHoursDay {
  if (typeof value !== "object" || value === null) return false;

  const day = value as Record<string, unknown>;
  return (
    typeof day.closed === "boolean" &&
    typeof day.open === "string" &&
    TIME_OF_DAY_PATTERN.test(day.open) &&
    typeof day.close === "string" &&
    TIME_OF_DAY_PATTERN.test(day.close)
  );
}

/**
 * Resuelve la semana completa: lo que llega en `patch` gana, después `base` y
 * por último el default. Se usa tanto para fusionar un parche del admin como
 * para leer el JSON guardado sin confiar en su forma.
 */
export function mergeBusinessHours(
  base: BusinessHoursPatch | null | undefined,
  patch: BusinessHoursPatch | null | undefined,
): BusinessHours {
  const merged = cloneBusinessHours(DEFAULT_BUSINESS_HOURS);

  for (const weekday of WEEKDAY_KEYS) {
    const day = patch?.[weekday] ?? base?.[weekday];
    if (day) {
      merged[weekday] = { closed: day.closed, open: day.open, close: day.close };
    }
  }

  return merged;
}

/**
 * Lee los horarios guardados en la base (JSON sin tipar) y descarta cualquier
 * día con forma inválida en vez de romper el sitio público.
 */
export function readBusinessHours(value: unknown): BusinessHours {
  const source =
    typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  const patch: BusinessHoursPatch = {};
  for (const weekday of WEEKDAY_KEYS) {
    const day = source[weekday];
    if (isBusinessHoursDay(day)) {
      patch[weekday] = { closed: day.closed, open: day.open, close: day.close };
    }
  }

  return mergeBusinessHours(null, patch);
}
