import type {
  NotificationPayload,
  NotificationSender,
} from "@/modules/notifications/ports/notification-sender";

export type RateLimitedSenderConfig = {
  sender: NotificationSender;
  maxPerMinute: number;
  key: string;
};

export class RateLimitedSender implements NotificationSender {
  private attempts = 0;
  private windowStart = Date.now();

  constructor(private readonly config: RateLimitedSenderConfig) {}

  async send(notification: NotificationPayload): Promise<void> {
    const now = Date.now();
    const oneMinute = 60_000;

    if (now - this.windowStart >= oneMinute) {
      this.windowStart = now;
      this.attempts = 0;
    }

    if (this.attempts >= this.config.maxPerMinute) {
      throw new Error(
        `Rate limit exceeded for ${this.config.key} (${this.config.maxPerMinute}/min)`,
      );
    }

    this.attempts++;
    await this.config.sender.send(notification);
  }
}
