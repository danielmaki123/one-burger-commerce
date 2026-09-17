import type { TelegramSendResult } from "@/modules/notifications/domain/telegram-result";

/**
 * Parte 3 del brief (alertas Telegram) — el puerto del mensajero.
 *
 * Una sola operación: mandar un texto a un chat. El **token no viaja acá**: es del servidor y lo resuelve
 * el adaptador, porque el brief es explícito en que el token vive en la variable de entorno y nunca en la
 * base ni en el repo. Sin token, el adaptador devuelve `token-missing` sin intentar la llamada.
 */
export interface TelegramGateway {
  sendMessage(input: { chatId: string; text: string }): Promise<TelegramSendResult>;
}
