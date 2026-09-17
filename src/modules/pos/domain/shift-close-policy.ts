import { businessDate } from "@/shared/lib/business-days";

/**
 * Tarea 3 del brief (2026-09-17) — **cierre obligatorio por sucursal** (1.7).
 *
 * Cada sucursal decide (desde su ficha) si el cierre de caja es obligatorio. Cuando lo es, la caja no puede
 * quedar abierta de un día para el otro: si al empezar a cobrar la caja abierta es de **otro día del
 * negocio**, el POS no deja cobrar hasta cerrarla.
 *
 * Por qué «otro día del negocio» y no «más de N horas»: el día de caja es el del negocio (misma regla que
 * el tablero y el cierre del día), así que un turno que abrió a las 23:00 y se cobra a las 00:30 sigue
 * siendo el mismo turno, no un descuido. Y por qué es una función pura con la zona por parámetro: sin la
 * zona, la comparación se hace contra UTC y el POS se bloquearía solo por la diferencia horaria.
 *
 * Devuelve `false` cuando no hay caja abierta: en ese caso el bloqueo que ya existe («abrí la caja para
 * cobrar», Bloque 9.2) es el que corresponde, y dos avisos distintos para el mismo problema confunden.
 */
export function mustCloseShiftBeforeCharging(input: {
  /** La sucursal exige cerrar la caja todos los días. */
  requireShiftClose: boolean;
  /** Cuándo se abrió la caja abierta; `null` si no hay ninguna. */
  openedAt: string | null;
  now: Date;
  timezone: string;
}): boolean {
  if (!input.requireShiftClose || !input.openedAt) return false;

  const opened = new Date(input.openedAt);
  if (Number.isNaN(opened.getTime())) return false;

  return businessDate(opened, input.timezone) !== businessDate(input.now, input.timezone);
}
