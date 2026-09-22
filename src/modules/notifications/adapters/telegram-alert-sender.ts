import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import {
  buildTelegramAlertText,
  type TelegramAlertFormat,
} from "@/modules/notifications/domain/telegram-alerts";
import { shouldSendTelegramAlert } from "@/modules/notifications/domain/notification-settings";
import { describeTelegramFailure } from "@/modules/notifications/domain/telegram-result";
import { isTelegramEvent } from "@/modules/notifications/domain/telegram-events";
import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";
import type { TelegramGateway } from "@/modules/notifications/ports/telegram-gateway";
import type {
  NotificationPayload,
  NotificationSender,
} from "@/modules/notifications/ports/notification-sender";

/**
 * Parte 3 del brief (alertas Telegram) — el sender que reenvía las alertas al grupo del negocio.
 *
 * Es la pieza que respeta las dos reglas del brief:
 *
 * 1. **El owner decide qué reenviar**: todos los eventos del sistema se registran igual en el outbox, y
 *    este sender mira la configuración y el toggle de cada evento. Un evento desactivado se descarta sin
 *    error (registrado en el sistema, no enviado a Telegram).
 * 2. **Si Telegram falla, no bloquea la operación**: tira el error para que el **outbox** lo reintente (3
 *    intentos) y anota el motivo en la configuración, que es lo que la pantalla muestra.
 *
 * El token del bot lo resuelve el gateway desde el entorno; acá solo viaja el `chatId` del negocio.
 */
export class TelegramAlertSender implements NotificationSender {
  constructor(
    private readonly deps: {
      settingsRepository: NotificationSettingsRepository;
      gateway: TelegramGateway;
      /** Formato del negocio (nombre, moneda, zona): se lee al primer envío y se reusa. */
      format?: () => Promise<TelegramAlertFormat>;
    },
  ) {}

  private cachedFormat: TelegramAlertFormat | null = null;

  private async resolveFormat(): Promise<TelegramAlertFormat> {
    if (this.cachedFormat) return this.cachedFormat;

    if (this.deps.format) {
      this.cachedFormat = await this.deps.format();
      return this.cachedFormat;
    }

    const settings = await loadBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });

    this.cachedFormat = {
      businessName: settings.name,
      currencySymbol: settings.currencySymbol,
      // Fase 3 del rediseño de Caja: el cuadre por banco puede traer una moneda distinta y hay que
      // escribirla con su código (el símbolo local en un lote de dólares sería un número falso).
      currencyCode: settings.currencyCode,
      timezone: settings.timezone,
      locale: settings.locale,
    };

    return this.cachedFormat;
  }

  async send(notification: NotificationPayload): Promise<void> {
    if (!isTelegramEvent(notification.eventType)) return;

    const settings = await this.deps.settingsRepository.get();
    const chatId = settings.chatId?.trim();

    if (!chatId || !shouldSendTelegramAlert(settings, notification.eventType)) return;

    const text = buildTelegramAlertText(
      notification.eventType,
      notification.payload,
      await this.resolveFormat(),
    );

    // Payload con forma inesperada: no se manda un mensaje con `undefined` adentro.
    if (!text) return;

    const result = await this.deps.gateway.sendMessage({ chatId, text });

    if (!result.ok) {
      const message = describeTelegramFailure(result);
      await this.deps.settingsRepository.recordSendResult({ error: message });

      throw new Error(message);
    }

    await this.deps.settingsRepository.recordSendResult({
      sentAt: new Date().toISOString(),
      error: null,
    });
  }
}
