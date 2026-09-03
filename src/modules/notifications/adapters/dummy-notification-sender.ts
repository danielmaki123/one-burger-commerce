import type {
  NotificationPayload,
  NotificationSender,
} from "@/modules/notifications/ports/notification-sender";

export class DummyNotificationSender implements NotificationSender {
  sent: NotificationPayload[] = [];
  shouldFail = false;

  async send(notification: NotificationPayload): Promise<void> {
    if (this.shouldFail) {
      throw new Error("Dummy sender failure");
    }
    this.sent.push(notification);
  }
}
