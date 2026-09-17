/**
 * Parte 3 del brief (alertas Telegram) — los errores de la configuración.
 *
 * Mismo contrato que los demás módulos (`status`, `code`, `message`, `fields` opcional) para que el mapeo
 * HTTP sea el de siempre: la pantalla muestra el mensaje tal cual y el campo que lo causó.
 */
export class NotificationSettingsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "NotificationSettingsError";
  }
}
