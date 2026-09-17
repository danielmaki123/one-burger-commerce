/**
 * Parte 3 del brief (alertas Telegram) — los eventos que el negocio puede elegir recibir.
 *
 * Lista **cerrada**: un texto libre no se puede agrupar ni traducir, y el owner elige entre opciones
 * concretas, no escribiendo claves. Cada evento nuevo se agrega acá con su etiqueta en español, y lo que
 * no está en la lista se descarta (no rompe la pantalla si el guardado es viejo).
 *
 * Decisión del owner (2026-09-17): el **cierre de cada turno avisa siempre** —un mensaje por cierre, sin
 * hora fija— y eso reemplaza al «resumen diario a las 22:00» (`day_close_summary`), que nunca se disparó
 * solo. La diferencia de caja dejó de ser un evento aparte: viene **dentro** de ese mismo mensaje, marcada
 * cuando pasa el umbral, para que un cierre con problema no mande dos mensajes al grupo.
 */
export const TELEGRAM_EVENTS = [
  "shift_closed",
  "shift_open_over_24h",
  "refund_over_threshold",
] as const;

export type TelegramEvent = (typeof TELEGRAM_EVENTS)[number];

export const TELEGRAM_EVENT_LABELS: Record<TelegramEvent, string> = {
  shift_closed: "Cierre de caja",
  shift_open_over_24h: "Turno sin cerrar >24 h",
  refund_over_threshold: "Devolución grande",
};

export const TELEGRAM_EVENT_DESCRIPTIONS: Record<TelegramEvent, string> = {
  shift_closed: "Cada turno que se cierra, con su sucursal, quién cerró y el arqueo.",
  shift_open_over_24h: "Una caja quedó abierta más de un día sin cerrarse.",
  refund_over_threshold: "Una devolución supera el monto que definiste.",
};

export function isTelegramEvent(value: unknown): value is TelegramEvent {
  return typeof value === "string" && (TELEGRAM_EVENTS as readonly string[]).includes(value);
}

/** Deja solo los eventos conocidos y sin repetir; cualquier otra cosa devuelve una lista vacía. */
export function normalizeTelegramEvents(value: unknown): TelegramEvent[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter(isTelegramEvent))];
}
