import { isValidTelegramChatId } from "@/modules/notifications/domain/notification-settings";
import { NotificationSettingsError } from "@/modules/notifications/domain/notification-settings-errors";
import { normalizeTelegramEvents } from "@/modules/notifications/domain/telegram-events";
import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";

export type UpdateNotificationSettingsInput = {
  chatId?: string | null;
  enabled?: boolean;
  eventsEnabled?: unknown;
  refundAlertThreshold?: number;
  differenceAlertThreshold?: number | null;
};

/**
 * Parte 3 del brief (alertas Telegram) — lo que el owner cambia desde la pantalla.
 *
 * Tres validaciones, todas con su mensaje: la **forma** del chat (`-100…` o `@canal`), los umbrales
 * (números de 0 para arriba) y la coherencia de **prender las alertas sin destino** — el error más fácil de
 * cometer y el más silencioso: quedaría «activado» sin que llegue nunca nada.
 */
export async function updateNotificationSettings(
  input: UpdateNotificationSettingsInput,
  { repository }: { repository: NotificationSettingsRepository },
) {
  const current = await repository.get();
  const patch: Parameters<NotificationSettingsRepository["save"]>[0] = {};

  if (input.chatId !== undefined) {
    const chatId = input.chatId?.trim() ?? "";

    if (chatId && !isValidTelegramChatId(chatId)) {
      throw new NotificationSettingsError(422, "VALIDATION_ERROR", "Revisá el chat_id.", {
        chatId: "Tiene que ser el id del grupo (empieza con -100) o un @canal público.",
      });
    }

    patch.chatId = chatId || null;
  }

  if (input.enabled !== undefined) patch.enabled = input.enabled;

  if (input.eventsEnabled !== undefined) {
    patch.eventsEnabled = normalizeTelegramEvents(input.eventsEnabled);
  }

  if (input.refundAlertThreshold !== undefined) {
    if (!Number.isFinite(input.refundAlertThreshold) || input.refundAlertThreshold < 0) {
      throw new NotificationSettingsError(422, "VALIDATION_ERROR", "Revisá el umbral.", {
        refundAlertThreshold: "Tiene que ser un monto de 0 para arriba.",
      });
    }

    patch.refundAlertThreshold = input.refundAlertThreshold;
  }

  if (input.differenceAlertThreshold !== undefined) {
    const threshold = input.differenceAlertThreshold;

    if (threshold !== null && (!Number.isFinite(threshold) || threshold < 0)) {
      throw new NotificationSettingsError(422, "VALIDATION_ERROR", "Revisá el umbral.", {
        differenceAlertThreshold: "Tiene que ser un monto de 0 para arriba, o vacío para no avisar.",
      });
    }

    patch.differenceAlertThreshold = threshold;
  }

  const nextChatId = patch.chatId === undefined ? current.chatId : patch.chatId;
  const nextEnabled = patch.enabled === undefined ? current.enabled : Boolean(patch.enabled);

  if (nextEnabled && !nextChatId?.trim()) {
    throw new NotificationSettingsError(
      422,
      "VALIDATION_ERROR",
      "Antes de prender las alertas, configurá el chat_id del grupo.",
      { chatId: "Falta el chat_id." },
    );
  }

  const settings = await repository.save(patch);

  return { data: settings };
}
