import { getPrismaClient } from "@/infrastructure/database/prisma";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_REFUND_ALERT_THRESHOLD,
  type NotificationSettingsRecord,
} from "@/modules/notifications/domain/notification-settings";
import { normalizeTelegramEvents } from "@/modules/notifications/domain/telegram-events";
import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";

const ROW_ID = "default";

type Row = {
  chatId: string | null;
  enabled: boolean;
  eventsEnabled: unknown;
  refundAlertThreshold: number;
  differenceAlertThreshold: number | null;
  lastSentAt: Date | null;
  lastError: string | null;
  updatedAt: Date;
};

function toRecord(row: Row): NotificationSettingsRecord {
  return {
    chatId: row.chatId,
    enabled: row.enabled,
    eventsEnabled: normalizeTelegramEvents(row.eventsEnabled),
    refundAlertThreshold: row.refundAlertThreshold,
    differenceAlertThreshold: row.differenceAlertThreshold,
    lastSentAt: row.lastSentAt ? row.lastSentAt.toISOString() : null,
    lastError: row.lastError,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Parte 3 del brief (alertas Telegram) — la configuración en Postgres.
 *
 * Una sola fila (`id = "default"`, como `BusinessSettings`): el MVP no es multi-tenant en la base, así que
 * el «chat del tenant» es el chat del negocio. El `upsert` de la lectura crea la fila vacía la primera vez
 * y evita que la pantalla tenga que preguntar si existe.
 */
export class PrismaNotificationSettingsRepository implements NotificationSettingsRepository {
  async get(): Promise<NotificationSettingsRecord> {
    const prisma = getPrismaClient();
    const row = await prisma.notificationSettings.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID, refundAlertThreshold: DEFAULT_REFUND_ALERT_THRESHOLD },
      update: {},
    });

    return toRecord(row);
  }

  async save(
    input: Partial<Omit<NotificationSettingsRecord, "lastSentAt" | "lastError" | "updatedAt">>,
  ): Promise<NotificationSettingsRecord> {
    const prisma = getPrismaClient();
    const row = await prisma.notificationSettings.upsert({
      where: { id: ROW_ID },
      create: {
        id: ROW_ID,
        chatId: input.chatId ?? DEFAULT_NOTIFICATION_SETTINGS.chatId,
        enabled: input.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
        eventsEnabled: input.eventsEnabled ?? [],
        refundAlertThreshold:
          input.refundAlertThreshold ?? DEFAULT_NOTIFICATION_SETTINGS.refundAlertThreshold,
        differenceAlertThreshold: input.differenceAlertThreshold ?? null,
      },
      update: {
        ...(input.chatId === undefined ? {} : { chatId: input.chatId }),
        ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
        ...(input.eventsEnabled === undefined ? {} : { eventsEnabled: input.eventsEnabled }),
        ...(input.refundAlertThreshold === undefined
          ? {}
          : { refundAlertThreshold: input.refundAlertThreshold }),
        ...(input.differenceAlertThreshold === undefined
          ? {}
          : { differenceAlertThreshold: input.differenceAlertThreshold }),
      },
    });

    return toRecord(row);
  }

  async recordSendResult(input: { sentAt?: string | null; error?: string | null }): Promise<void> {
    const prisma = getPrismaClient();
    const data = {
      ...(input.sentAt === undefined ? {} : { lastSentAt: input.sentAt ? new Date(input.sentAt) : null }),
      ...(input.error === undefined ? {} : { lastError: input.error }),
    };

    if (Object.keys(data).length === 0) return;

    await prisma.notificationSettings.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID, ...data },
      update: data,
    });
  }
}
