import type { TelegramEvent } from "./telegram-events";

/**
 * Parte 3 del brief (alertas Telegram) — la configuración del negocio y las decisiones que se derivan.
 *
 * El **token del bot** no está acá: es del SaaS y va por entorno. Lo que se guarda es el grupo del
 * negocio, si las alertas están prendidas, qué eventos quiere y los dos umbrales.
 *
 * La regla de envío vive en una función pura (`shouldSendTelegramAlert`) y no en el adaptador: es la
 * misma pregunta que hace la pantalla y la que decide si el outbox manda o no, así que se prueba una vez.
 */
export type NotificationSettingsRecord = {
  chatId: string | null;
  /** Interruptor general de las alertas por Telegram. */
  enabled: boolean;
  eventsEnabled: TelegramEvent[];
  /** Bloque 3.7: devolución que supera este monto avisa al dueño. */
  refundAlertThreshold: number;
  /** Diferencia de caja que supera este monto avisa. `null` = no avisar. */
  differenceAlertThreshold: number | null;
  lastSentAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

/** Estado que muestra la pantalla. */
export type TelegramStatus = "conectado" | "desconectado" | "sin-configurar" | "sin-token";

export const DEFAULT_REFUND_ALERT_THRESHOLD = 500;

/**
 * Decisión del owner (2026-09-17): el **cierre de cada turno avisa por defecto**. Es el aviso que reemplaza
 * al «resumen diario»: llega apenas se cierra la caja, con la sucursal y el arqueo. Los otros dos eventos
 * se prenden a mano (son avisos de problemas, no de operación normal).
 */
export const DEFAULT_TELEGRAM_EVENTS: TelegramEvent[] = ["shift_closed"];

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsRecord = {
  chatId: null,
  enabled: false,
  eventsEnabled: DEFAULT_TELEGRAM_EVENTS,
  refundAlertThreshold: DEFAULT_REFUND_ALERT_THRESHOLD,
  differenceAlertThreshold: null,
  lastSentAt: null,
  lastError: null,
  updatedAt: new Date(0).toISOString(),
};

/**
 * ¿Corresponde mandar este evento? Las tres condiciones juntas: alertas prendidas, grupo configurado y el
 * evento elegido. Los eventos que no pasan **igual quedan registrados** en el outbox: el owner decide qué
 * reenviar, no qué existe.
 */
export function shouldSendTelegramAlert(
  settings: Pick<NotificationSettingsRecord, "chatId" | "enabled" | "eventsEnabled">,
  event: TelegramEvent,
): boolean {
  if (!settings.enabled) return false;
  if (!settings.chatId?.trim()) return false;

  return settings.eventsEnabled.includes(event);
}

/**
 * El estado de la conexión, tal como lo lee el owner. El orden importa: sin token del bot en el servidor no
 * hay nada que probar (es una variable de entorno, no algo que él pueda arreglar desde la pantalla); sin
 * chat está «sin configurar» (aunque el interruptor esté prendido); con chat pero apagado o con el último
 * error, «desconectado» —que es el estado que se arregla probando la conexión—.
 */
export function resolveTelegramStatus(
  settings: Pick<NotificationSettingsRecord, "chatId" | "enabled" | "lastError">,
  { tokenConfigured }: { tokenConfigured: boolean },
): TelegramStatus {
  if (!tokenConfigured) return "sin-token";
  if (!settings.chatId?.trim()) return "sin-configurar";
  if (!settings.enabled) return "desconectado";
  if (settings.lastError) return "desconectado";

  return "conectado";
}

/**
 * Lo que Telegram acepta como destino: un id numérico (los grupos son negativos, `-100…`) o un `@canal`
 * público. Se valida la **forma** acá; si el chat existe o el bot está adentro lo dice la API al probar.
 */
export function isValidTelegramChatId(value: string): boolean {
  const trimmed = value.trim();

  return /^-?\d{5,20}$/.test(trimmed) || /^@[A-Za-z0-9_]{4,64}$/.test(trimmed);
}
