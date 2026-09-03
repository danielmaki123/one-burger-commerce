import { afterEach, describe, expect, it } from "vitest";

import { DummyNotificationSender } from "@/modules/notifications/adapters/dummy-notification-sender";
import { MultiNotificationSender } from "@/modules/notifications/adapters/multi-notification-sender";
import { N8nWebhookSender } from "@/modules/notifications/adapters/n8n-webhook-sender";
import { TelegramDryRunSender } from "@/modules/notifications/adapters/telegram-dry-run-sender";
import { TelegramNotificationSender } from "@/modules/notifications/adapters/telegram-notification-sender";

import { createNotificationSenderFromEnv } from "./notification-sender-factory";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete (process.env as Record<string, string | undefined>)[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
}

describe("createNotificationSenderFromEnv", () => {
  afterEach(() => {
    resetEnv();
  });

  it("uses dummy sender by default", () => {
    delete process.env.NOTIFICATIONS_DRIVER;
    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(DummyNotificationSender);
  });

  it("uses telegram dry-run sender when configured", () => {
    process.env.NOTIFICATIONS_DRIVER = "telegram_dry_run";
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "false";
    process.env.TELEGRAM_CHAT_ID = "dummy-chat";

    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(TelegramDryRunSender);
  });

  it("uses telegram real sender when configured", () => {
    process.env.NOTIFICATIONS_DRIVER = "telegram";
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "true";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "chat-id";

    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(TelegramNotificationSender);
  });

  it("falls back to dummy when telegram env is incomplete", () => {
    process.env.NOTIFICATIONS_DRIVER = "telegram";
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = "chat-id";

    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(DummyNotificationSender);
  });

  it("uses n8n webhook sender when configured", () => {
    process.env.NOTIFICATIONS_DRIVER = "n8n_webhook";
    process.env.N8N_WEBHOOK_BASE_URL = "https://n8n.example.com/webhook";

    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(N8nWebhookSender);
  });

  it("falls back to dummy when n8n base url is missing", () => {
    process.env.NOTIFICATIONS_DRIVER = "n8n_webhook";
    delete process.env.N8N_WEBHOOK_BASE_URL;

    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(DummyNotificationSender);
  });

  it("uses multi sender when configured with telegram", () => {
    process.env.NOTIFICATIONS_DRIVER = "multi";
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "true";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    process.env.TELEGRAM_CHAT_ID = "chat-id";

    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(MultiNotificationSender);
  });

  it("falls back to dummy when multi has no valid sub-senders", () => {
    process.env.NOTIFICATIONS_DRIVER = "multi";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.N8N_WEBHOOK_BASE_URL;

    const sender = createNotificationSenderFromEnv();
    expect(sender).toBeInstanceOf(DummyNotificationSender);
  });
});
