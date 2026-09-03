import type {
  NotificationPayload,
  NotificationSender,
} from "@/modules/notifications/ports/notification-sender";

export type N8nWebhookSenderConfig = {
  baseUrl: string;
  secret?: string;
  timeoutMs?: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactSecret(value: string, secret?: string): string {
  if (!secret) {
    return value;
  }

  return value.replaceAll(secret, "[REDACTED]");
}

function sanitizeError(error: unknown, secret?: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  return redactSecret(raw, secret);
}

export class N8nWebhookSender implements NotificationSender {
  constructor(private readonly config: N8nWebhookSenderConfig) {}

  async send(notification: NotificationPayload): Promise<void> {
    const { baseUrl, secret, timeoutMs = 10000 } = this.config;

    const url = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (secret) {
        headers["X-N8N-Webhook-Secret"] = secret;
      }

      const payloadFields = isPlainObject(notification.payload)
        ? notification.payload
        : {};

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...notification,
          ...payloadFields,
          body: notification.payload,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "unknown");
        const safeBody = redactSecret(body, secret);
        throw new Error(
          `n8n webhook HTTP ${response.status}: ${safeBody.slice(0, 200)}`,
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("n8n webhook request timeout", { cause: err });
      }
      const safeMessage = sanitizeError(err, secret);
      throw new Error(safeMessage, { cause: err });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
