import { DummyNotificationSender } from "@/modules/notifications/adapters/dummy-notification-sender";
import { MultiNotificationSender } from "@/modules/notifications/adapters/multi-notification-sender";
import { N8nWebhookSender } from "@/modules/notifications/adapters/n8n-webhook-sender";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { TelegramAlertSender } from "@/modules/notifications/adapters/telegram-alert-sender";
import { TelegramDryRunSender } from "@/modules/notifications/adapters/telegram-dry-run-sender";
import { TelegramHttpGateway } from "@/modules/notifications/adapters/telegram-http-gateway";
import { TelegramNotificationSender } from "@/modules/notifications/adapters/telegram-notification-sender";
import type { NotificationPayload, NotificationSender } from "@/modules/notifications/ports/notification-sender";

type Driver =
  | "dummy"
  | "telegram_dry_run"
  | "telegram"
  | "telegram_alerts"
  | "n8n_webhook"
  | "multi";

function parseBoolean(raw: string | undefined, fallback = false): boolean {
  if (!raw) return fallback;
  return raw.toLowerCase() === "true";
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

function defaultChannelRouter(_notification: NotificationPayload): string[] {
  return ["telegram_alerts", "telegram", "n8n_webhook"];
}

/**
 * Parte 3 del brief (alertas Telegram) — el sender de las alertas del negocio, con su chat en la base.
 *
 * `telegram_alerts` es el driver nuevo: el **token** sigue siendo del servidor (entorno) y el chat, los
 * eventos y los umbrales salen de `NotificationSettings`. Por eso `hasDeliverableNotificationSenderFromEnv`
 * solo exige el token: el chat lo pone el negocio desde el admin, no Easypanel.
 */
export function createTelegramAlertSenderFromEnv(): NotificationSender | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) return null;

  return new TelegramAlertSender({
    settingsRepository: new PrismaNotificationSettingsRepository(),
    gateway: new TelegramHttpGateway({
      botToken,
      timeoutMs: parseIntEnv(process.env.TELEGRAM_TIMEOUT_MS, 10000),
    }),
  });
}

export function hasDeliverableNotificationSenderFromEnv(): boolean {
  const raw = (process.env.NOTIFICATIONS_DRIVER ?? "dummy").toLowerCase();
  const driver: Driver =
    raw === "telegram_dry_run"
      ? "telegram_dry_run"
      : raw === "telegram"
        ? "telegram"
        : raw === "telegram_alerts"
          ? "telegram_alerts"
          : raw === "n8n_webhook"
            ? "n8n_webhook"
            : raw === "multi"
              ? "multi"
              : "dummy";

  if (driver === "telegram") {
    return (
      parseBoolean(process.env.TELEGRAM_NOTIFICATIONS_ENABLED, false) &&
      Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
      Boolean(process.env.TELEGRAM_CHAT_ID)
    );
  }

  if (driver === "telegram_alerts") {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN);
  }

  if (driver === "n8n_webhook") {
    return Boolean(process.env.N8N_WEBHOOK_BASE_URL);
  }

  if (driver === "multi") {
    const hasTelegram =
      parseBoolean(process.env.TELEGRAM_NOTIFICATIONS_ENABLED, false) &&
      Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
      Boolean(process.env.TELEGRAM_CHAT_ID);

    const hasN8n = Boolean(process.env.N8N_WEBHOOK_BASE_URL);

    return Boolean(process.env.TELEGRAM_BOT_TOKEN) || hasTelegram || hasN8n;
  }

  return false;
}

export function createNotificationSenderFromEnv(): NotificationSender {
  const raw = (process.env.NOTIFICATIONS_DRIVER ?? "dummy").toLowerCase();
  const driver: Driver =
    raw === "telegram_dry_run"
      ? "telegram_dry_run"
      : raw === "telegram"
        ? "telegram"
        : raw === "telegram_alerts"
          ? "telegram_alerts"
          : raw === "n8n_webhook"
            ? "n8n_webhook"
            : raw === "multi"
              ? "multi"
              : "dummy";

  if (driver === "telegram_alerts") {
    const sender = createTelegramAlertSenderFromEnv();
    if (sender) return sender;

    console.warn(
      "[notification-sender-factory] TELEGRAM_BOT_TOKEN missing; falling back to dummy sender.",
    );
    return new DummyNotificationSender();
  }

  if (driver === "telegram_dry_run") {
    return new TelegramDryRunSender({
      enabled: parseBoolean(process.env.TELEGRAM_NOTIFICATIONS_ENABLED, false),
      chatId: process.env.TELEGRAM_CHAT_ID,
    });
  }

  if (driver === "telegram") {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) {
      console.warn(
        "[notification-sender-factory] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing; falling back to dummy sender.",
      );
      return new DummyNotificationSender();
    }
    return new TelegramNotificationSender({
      botToken,
      chatId,
      enabled: parseBoolean(process.env.TELEGRAM_NOTIFICATIONS_ENABLED, false),
      timeoutMs: parseIntEnv(process.env.TELEGRAM_TIMEOUT_MS, 10000),
    });
  }

  if (driver === "n8n_webhook") {
    const baseUrl = process.env.N8N_WEBHOOK_BASE_URL;
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!baseUrl) {
      console.warn(
        "[notification-sender-factory] N8N_WEBHOOK_BASE_URL missing; falling back to dummy sender.",
      );
      return new DummyNotificationSender();
    }
    return new N8nWebhookSender({
      baseUrl,
      secret,
      timeoutMs: parseIntEnv(process.env.N8N_TIMEOUT_MS, 10000),
    });
  }

  if (driver === "multi") {
    const senders: Record<string, NotificationSender> = {};

    const alerts = createTelegramAlertSenderFromEnv();
    if (alerts) {
      // Las alertas del negocio (chat y eventos en la base) viajan por su propio canal.
      senders["telegram_alerts"] = alerts;
    }

    const telegramEnabled = parseBoolean(
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED,
      false,
    );
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (telegramEnabled && botToken && chatId) {
      senders["telegram"] = new TelegramNotificationSender({
        botToken,
        chatId,
        enabled: true,
        timeoutMs: parseIntEnv(process.env.TELEGRAM_TIMEOUT_MS, 10000),
      });
    }

    const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL;
    const n8nSecret = process.env.N8N_WEBHOOK_SECRET;
    if (n8nBaseUrl) {
      senders["n8n_webhook"] = new N8nWebhookSender({
        baseUrl: n8nBaseUrl,
        secret: n8nSecret,
        timeoutMs: parseIntEnv(process.env.N8N_TIMEOUT_MS, 10000),
      });
    }

    if (Object.keys(senders).length === 0) {
      console.warn(
        "[notification-sender-factory] multi driver configured but no valid sub-senders found; falling back to dummy sender.",
      );
      return new DummyNotificationSender();
    }

    return new MultiNotificationSender({
      senders,
      router: defaultChannelRouter,
    });
  }

  return new DummyNotificationSender();
}
