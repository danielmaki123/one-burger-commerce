import type { NotificationSettingsRecord } from "@/modules/notifications/domain/notification-settings";

/**
 * Parte 3 del brief (alertas Telegram) — dónde vive la configuración del negocio.
 *
 * Tres operaciones y nada más: leer la configuración (creándola vacía la primera vez), guardar lo que el
 * owner cambió y **anotar el resultado del último envío** (cuándo salió bien o por qué falló, que es lo que
 * la pantalla muestra como «Último envío»).
 */
export interface NotificationSettingsRepository {
  get(): Promise<NotificationSettingsRecord>;
  save(
    input: Partial<Omit<NotificationSettingsRecord, "lastSentAt" | "lastError" | "updatedAt">>,
  ): Promise<NotificationSettingsRecord>;
  recordSendResult(input: { sentAt?: string | null; error?: string | null }): Promise<void>;
}
