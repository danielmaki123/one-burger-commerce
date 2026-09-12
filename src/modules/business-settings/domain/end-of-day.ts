/**
 * "Vence el 31/12" (T9c).
 *
 * El admin elige la fecha con un `<input type="date">`, que manda solo `YYYY-MM-DD`.
 * Guardar eso tal cual lo interpreta `new Date()` es 31/12 00:00 **UTC**: en Managua
 * (UTC-6) la promo dejaría de servir a las 18:00 del 30, un día antes de lo que el
 * owner quiso. Acá la fecha se traduce al final de ese día **en la zona del negocio**,
 * y al revés para volver a mostrar el formulario sin corrimientos.
 *
 * No usa librerías: `Intl` ya sabe el offset de cada zona en cada fecha (incluido el
 * horario de verano). Una zona desconocida cae a UTC, igual que en `pickup-slots`.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Offset de la zona, en milisegundos, para ese instante (positivo al este de UTC). */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const truncated = date.getTime() - date.getUTCMilliseconds();

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date);

    const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "");
    const asUtc = Date.UTC(
      read("year"),
      read("month") - 1,
      read("day"),
      read("hour"),
      read("minute"),
      read("second"),
    );

    return Number.isFinite(asUtc) ? asUtc - truncated : 0;
  } catch {
    return 0;
  }
}

/** `2026-12-31` → el instante en que termina ese día en `timeZone`. `null` si no es una fecha. */
export function endOfDayInTimeZone(dateOnly: string, timeZone: string): string | null {
  if (!DATE_ONLY_PATTERN.test(dateOnly)) return null;

  const [year, month, day] = dateOnly.split("-").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  if (!Number.isFinite(wallClock)) return null;

  // Dos pasadas: la primera estima con el offset del instante crudo, la segunda
  // corrige si el offset cambió (cambio de horario de verano).
  let instant = wallClock;
  for (let pass = 0; pass < 2; pass += 1) {
    instant = wallClock - zoneOffsetMs(new Date(instant), timeZone);
  }

  return new Date(instant).toISOString();
}

/** `2027-01-01T05:59:59.999Z` + Managua → `2026-12-31`, para precargar el formulario. */
export function dateOnlyInTimeZone(instantIso: string, timeZone: string): string | null {
  const date = new Date(instantIso);
  if (Number.isNaN(date.getTime())) return null;

  try {
    // `en-CA` formatea como `YYYY-MM-DD`.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
}
