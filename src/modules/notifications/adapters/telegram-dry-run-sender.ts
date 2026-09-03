import type {
  NotificationPayload,
  NotificationSender,
} from "@/modules/notifications/ports/notification-sender";

export class TelegramDryRunSender implements NotificationSender {
  constructor(
    private readonly config: {
      enabled: boolean;
      chatId?: string;
    },
  ) {}

  async send(notification: NotificationPayload): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const target = this.config.chatId ?? "unset-chat-id";
    console.info(
      `[telegram-dry-run] target=${target} event=${notification.eventType} aggregate=${notification.aggregateType}:${notification.aggregateId}`,
    );
  }
}
