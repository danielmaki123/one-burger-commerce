import {
  addDays,
  dateInTimeZone,
  pickupInstant,
} from "@/modules/business-settings/domain/pickup-days";

/**
 * El **día del negocio** y su rango, en la zona configurada.
 *
 * El día de caja y de cocina es el del negocio, no el del servidor ni el del navegador: un cierre de las
 * 23:40 en Managua no puede caer en el día siguiente porque el servidor corre en UTC. Vivía en los
 * helpers de la bandeja de órdenes; se movió acá cuando el cierre del día consolidado (Bloques 11.5/11.6)
 * necesitó el mismo rango: una sola implementación para las dos pantallas.
 *
 * La zona horaria es un parámetro obligatorio a propósito: sin ella no se puede saber de qué día se
 * habla, y el compilador lo exige.
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
