import type {
  NotificationPayload,
  NotificationSender,
} from "@/modules/notifications/ports/notification-sender";
import {
  formatOrderCreatedTelegramMessage,
  type OrderCreatedNotificationPayload,
} from "@/modules/notifications/domain/order-created-notification";

export type TelegramNotificationSenderConfig = {
  botToken: string;
  chatId: string;
  enabled: boolean;
  timeoutMs?: number;
};

function sanitizeError(err: unknown, botToken: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replaceAll(botToken, "[REDACTED]");
}

function isOrderCreatedNotificationPayload(
  payload: unknown,
): payload is OrderCreatedNotificationPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    candidate.event === "new_order" &&
    typeof candidate.order_id === "string" &&
    typeof candidate.internal_id === "string" &&
    typeof candidate.customer === "object" &&
    candidate.customer !== null &&
    typeof candidate.ticket === "object" &&
    candidate.ticket !== null
  );
}

export class TelegramNotificationSender implements NotificationSender {
  constructor(private readonly config: TelegramNotificationSenderConfig) {}

  async send(notification: NotificationPayload): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const { botToken, chatId, timeoutMs = 10000 } = this.config;

    const text = this.formatMessage(notification);
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "unknown");
        const safeBody = body.replaceAll(botToken, "[REDACTED]");
        throw new Error(
          `Telegram HTTP ${response.status}: ${safeBody.slice(0, 200)}`,
        );
      }

      const data = (await response.json()) as { ok?: boolean; description?: string };
      if (data.ok !== true) {
        const desc = data.description ?? "unknown error";
        throw new Error(`Telegram API error: ${desc}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Telegram request timeout", { cause: error });
      }
      const safeMessage = sanitizeError(error, botToken);
      throw new Error(safeMessage, { cause: error });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private formatMessage(notification: NotificationPayload): string {
    const { eventType, aggregateType, aggregateId, payload } = notification;

    if (eventType === "OrderCreated" && isOrderCreatedNotificationPayload(payload)) {
      return formatOrderCreatedTelegramMessage(payload);
    }

    let msg = `<b>${eventType}</b>\n`;
    msg += `Aggregate: ${aggregateType}:${aggregateId}\n`;
    if (payload && typeof payload === "object") {
      msg += `Payload: <pre>${JSON.stringify(payload, null, 2).slice(0, 1000)}</pre>`;
    }
    return msg;
  }
}
