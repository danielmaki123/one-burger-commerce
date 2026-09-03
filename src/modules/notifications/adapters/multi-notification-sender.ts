import type {
  NotificationPayload,
  NotificationSender,
} from "@/modules/notifications/ports/notification-sender";

export type ChannelRouter = (
  notification: NotificationPayload,
) => string[];

export type MultiNotificationSenderConfig = {
  senders: Record<string, NotificationSender>;
  router: ChannelRouter;
};

export class MultiNotificationSender implements NotificationSender {
  constructor(private readonly config: MultiNotificationSenderConfig) {}

  async send(notification: NotificationPayload): Promise<void> {
    const channels = this.config.router(notification);
    const seen = new Set<string>();
    const errors: string[] = [];

    for (const channel of channels) {
      if (seen.has(channel)) continue;
      seen.add(channel);

      const sender = this.config.senders[channel];
      if (!sender) {
        errors.push(`${channel}: missing sender`);
        continue;
      }

      try {
        await sender.send(notification);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${channel}: ${message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Multi sender failures: ${errors.join("; ")}`);
    }
  }
}
