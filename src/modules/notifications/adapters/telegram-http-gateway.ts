import type {
  TelegramBotIdentity,
  TelegramFailureReason,
  TelegramSendResult,
} from "@/modules/notifications/domain/telegram-result";
import type { TelegramGateway } from "@/modules/notifications/ports/telegram-gateway";

/**
 * Parte 3 del brief (alertas Telegram) — el mensajero real, contra `api.telegram.org`.
 *
 * `fetch` nativo: el brief pide **sin dependencias nuevas** y sin n8n. El token sale del entorno
 * (`TELEGRAM_BOT_TOKEN`, del SaaS) y **nunca** se devuelve ni se escribe en un log: el detalle de cada
 * error se limpia antes de salir, y por eso los tests comprueban que el token no aparece en el resultado.
 *
 * Los códigos de Telegram se traducen a motivos del dominio para que la pantalla pueda decir qué arreglar
 * (400 = chat_id inválido, 403 = el bot no está en el grupo, 401 = token inválido), que es exactamente lo
 * que pidió el brief.
 */
export class TelegramHttpGateway implements TelegramGateway {
  constructor(
    private readonly config: { botToken: string | undefined; timeoutMs?: number },
  ) {}

  async sendMessage(input: { chatId: string; text: string }): Promise<TelegramSendResult> {
    const token = this.config.botToken?.trim();
    if (!token) {
      return {
        ok: false,
        reason: "token-missing",
        detail: "Falta TELEGRAM_BOT_TOKEN en el servidor.",
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000);

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: input.chatId, text: input.text, parse_mode: "HTML" }),
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; description?: string }
        | null;

      if (!response.ok || body?.ok !== true) {
        return {
          ok: false,
          reason: this.reasonFor(response.status),
          detail: this.clean(body?.description ?? `HTTP ${response.status}`, token).slice(0, 200),
        };
      }

      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { ok: false, reason: "timeout", detail: "Sin respuesta en el tiempo esperado." };
      }

      return { ok: false, reason: "network", detail: this.clean(String(error), token).slice(0, 200) };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * `getMe`: el `@usuario` del bot configurado. Es una lectura de la pantalla (no toca el envío de
   * alertas) y nunca devuelve el token: si Telegram contesta con error, queda en `null` y la pantalla omite
   * la línea.
   */
  async getBotIdentity(): Promise<TelegramBotIdentity> {
    const token = this.config.botToken?.trim();
    if (!token) return { username: null };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10_000);

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; result?: { username?: string } }
        | null;

      if (!response.ok || body?.ok !== true) return { username: null };

      const username = body.result?.username?.trim();

      return { username: username ? username : null };
    } catch {
      return { username: null };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private reasonFor(status: number): TelegramFailureReason {
    if (status === 400) return "chat-invalid";
    if (status === 401) return "unauthorized";
    if (status === 403) return "bot-not-in-chat";
    if (status === 408 || status === 504) return "timeout";

    return "api-error";
  }

  /** Nada de lo que sale de acá puede contener el token: ni un mensaje de error de Telegram. */
  private clean(message: string, token: string): string {
    return message.replaceAll(token, "[REDACTED]");
  }
}
