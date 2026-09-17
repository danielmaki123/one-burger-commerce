import {
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettingsRecord,
} from "@/modules/notifications/domain/notification-settings";
import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";

/** Doble en memoria de la configuración de alertas, para los tests de los casos de uso. */
export class InMemoryNotificationSettingsRepository implements NotificationSettingsRepository {
  private current: NotificationSettingsRecord = { ...DEFAULT_NOTIFICATION_SETTINGS };

  constructor(initial: Partial<NotificationSettingsRecord> = {}) {
    this.current = { ...this.current, ...initial };
  }

  async get(): Promise<NotificationSettingsRecord> {
    return { ...this.current };
  }

  async save(
    input: Partial<Omit<NotificationSettingsRecord, "lastSentAt" | "lastError" | "updatedAt">>,
  ): Promise<NotificationSettingsRecord> {
    this.current = { ...this.current, ...input, updatedAt: new Date().toISOString() };

    return { ...this.current };
  }

  async recordSendResult(input: { sentAt?: string | null; error?: string | null }): Promise<void> {
    this.current = {
      ...this.current,
      ...(input.sentAt === undefined ? {} : { lastSentAt: input.sentAt }),
      ...(input.error === undefined ? {} : { lastError: input.error }),
    };
  }
}
