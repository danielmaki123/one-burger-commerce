import type { TelegramBotIdentity, TelegramSendResult } from "@/modules/notifications/domain/telegram-result";

/**
 * Parte 3 del brief (alertas Telegram) — el puerto del mensajero.
 *
 * Dos operaciones: mandar un texto a un chat y preguntar **quién es el bot** (para que la pantalla pueda
 * mostrar `Bot: @nombre` y el dueño reconozca con cuál está hablando). El **token no viaja acá**: es del
 * servidor y lo resuelve el adaptador, porque el brief es explícito en que el token vive en la variable de
 * entorno y nunca en la base ni en el repo. Sin token, el adaptador devuelve `token-missing` sin intentar
 * la llamada.
 */
export interface TelegramGateway {
  sendMessage(input: { chatId: string; text: string }): Promise<TelegramSendResult>;

  /** El `@usuario` del bot configurado. `null` = no se pudo preguntar (sin token, red o API). */
  getBotIdentity(): Promise<TelegramBotIdentity>;
}
