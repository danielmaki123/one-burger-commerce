import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { NotificationSettingsError } from "@/modules/notifications/domain/notification-settings-errors";
import { describeTelegramFailure } from "@/modules/notifications/domain/telegram-result";
import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";
import type { TelegramGateway } from "@/modules/notifications/ports/telegram-gateway";

/**
 * Parte 3 del brief (alertas Telegram) — «Probar conexión».
 *
 * El brief es explícito: **manda un mensaje real**, sin simulación. Por eso este caso de uso no devuelve
 * «parece que anda»: llama a la API y guarda el resultado (cuándo salió bien o por qué falló), que es lo
 * que la pantalla muestra como estado y como «Último envío».
 *
 * Si falla, tira un error con el **motivo específico** traducido (chat_id inválido, el bot no está en el
 * grupo, falta el token): el owner arregla cosas distintas en cada caso. El nombre del negocio sale de la
 * configuración, no de un literal: el mensaje de prueba tiene que decir cómo se llama **este** negocio.
 */
export async function testTelegramConnection({
  repository,
  gateway,
  loadBusinessName = async () =>
    (await loadBusinessSettings({ repository: new PrismaBusinessSettingsRepository() })).name,
}: {
  repository: NotificationSettingsRepository;
  gateway: TelegramGateway;
  loadBusinessName?: () => Promise<string>;
}) {
  const settings = await repository.get();
  const chatId = settings.chatId?.trim();

  if (!chatId) {
    throw new NotificationSettingsError(422, "VALIDATION_ERROR", "Primero configurá el chat_id.", {
      chatId: "Falta el chat_id.",
    });
  }

  const text = `✅ <b>${await loadBusinessName()}</b>\nPrueba de conexión de las alertas. Si ves este mensaje, el grupo está bien configurado.`;
  const result = await gateway.sendMessage({ chatId, text });

  if (!result.ok) {
    const message = describeTelegramFailure(result);
    await repository.recordSendResult({ error: message });

    throw new NotificationSettingsError(502, "TELEGRAM_SEND_FAILED", message);
  }

  await repository.recordSendResult({ sentAt: new Date().toISOString(), error: null });

  return { data: { status: "conectado" as const } };
}
