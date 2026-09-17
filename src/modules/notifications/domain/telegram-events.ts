/**
 * Parte 3 del brief (alertas Telegram) — los eventos que el negocio puede elegir recibir.
 *
 * Lista **cerrada**: un texto libre no se puede agrupar ni traducir, y el owner elige entre opciones
 * concretas, no escribiendo claves. Cada evento nuevo se agrega acá con su etiqueta en español, y lo que
 * no está en la lista se descarta (no rompe la pantalla si el guardado es viejo).
 */
export const TELEGRAM_EVENTS = [
  "shift_open_over_24h",
  "refund_over_threshold",
  "cash_difference_over_threshold",
  "day_close_summary",
] as const;

export type TelegramEvent = (typeof TELEGRAM_EVENTS)[number];

export const TELEGRAM_EVENT_LABELS: Record<TelegramEvent, string> = {
  shift_open_over_24h: "Turno sin cerrar >24 h",
  refund_over_threshold: "Devolución grande",
  cash_difference_over_threshold: "Diferencia de caja",
  day_close_summary: "Cierre del día (resumen)",
};

export const TELEGRAM_EVENT_DESCRIPTIONS: Record<TelegramEvent, string> = {
  shift_open_over_24h: "Una caja quedó abierta más de un día sin cerrarse.",
  refund_over_threshold: "Una devolución supera el monto que definiste.",
  cash_difference_over_threshold: "Un cierre quedó con diferencia por encima del monto que definiste.",
  // Honestidad con el estado real: se puede dejar elegido, pero el resumen todavía no se dispara solo.
  day_close_summary: "Un resumen del día con la plata de todas las sucursales (todavía no se dispara solo).",
};

export function isTelegramEvent(value: unknown): value is TelegramEvent {
  return typeof value === "string" && (TELEGRAM_EVENTS as readonly string[]).includes(value);
}

/** Deja solo los eventos conocidos y sin repetir; cualquier otra cosa devuelve una lista vacía. */
export function normalizeTelegramEvents(value: unknown): TelegramEvent[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter(isTelegramEvent))];
}
