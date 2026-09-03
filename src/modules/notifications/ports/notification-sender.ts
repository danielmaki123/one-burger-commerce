export type NotificationPayload = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
};

export interface NotificationSender {
  send(notification: NotificationPayload): Promise<void>;
}
