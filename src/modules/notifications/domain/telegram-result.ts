/**
 * Parte 3 del brief (alertas Telegram) — el resultado de mandar un mensaje.
 *
 * El gateway **no tira excepciones**: devuelve el motivo. La diferencia importa porque los dos usos son
 * distintos: la pantalla necesita el motivo para decir «chat_id inválido» o «el bot no está en el grupo»
 * (el owner arregla cosas distintas en cada caso), y el outbox necesita que un fallo se propague como
 * error para reintentar. El motivo viaja tipado y el adaptador decide qué hacer con él.
 */
export type TelegramFailureReason =
  | "token-missing"
  | "chat-invalid"
  | "bot-not-in-chat"
  | "unauthorized"
  | "timeout"
  | "network"
  | "api-error";

export type TelegramSendResult =
  | { ok: true }
  | { ok: false; reason: TelegramFailureReason; detail: string };

/** Lo que se le muestra al owner, en español y sin jerga: cada motivo tiene su arreglo. */
export const TELEGRAM_FAILURE_MESSAGES: Record<TelegramFailureReason, string> = {
  "token-missing":
    "El servidor no tiene configurado el bot (TELEGRAM_BOT_TOKEN). Avisale al administrador del sistema.",
  "chat-invalid":
    "El chat_id no existe o está mal escrito. Copiá el id del grupo donde esté el bot (los grupos empiezan con -100).",
  "bot-not-in-chat":
    "El bot no está en ese grupo. Agregalo como miembro y volvé a probar.",
  unauthorized: "El token del bot no es válido. Avisale al administrador del sistema.",
  timeout: "Telegram no respondió a tiempo. Probá de nuevo en un rato.",
  network: "No se pudo llegar a Telegram desde el servidor. Revisá la conexión y probá de nuevo.",
  "api-error": "Telegram rechazó el mensaje.",
};

export function describeTelegramFailure(result: {
  reason: TelegramFailureReason;
  detail: string;
}): string {
  const base = TELEGRAM_FAILURE_MESSAGES[result.reason];

  return result.detail ? `${base} (${result.detail})` : base;
}
