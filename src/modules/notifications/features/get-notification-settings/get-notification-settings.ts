import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";

/**
 * Parte 3 del brief (alertas Telegram) — leer la configuración de alertas.
 *
 * `tokenConfigured` viaja como dato y no se lee del entorno acá: el token es del servidor y quien compone
 * (la página o la ruta) es el que sabe si está puesto. La pantalla lo necesita para distinguir «falta el
 * token en el servidor» de «falta configurar el chat», que se arreglan de maneras distintas.
 */
export async function getNotificationSettings(
  { repository }: { repository: NotificationSettingsRepository },
  { tokenConfigured }: { tokenConfigured: boolean },
) {
  const settings = await repository.get();

  return { data: settings, meta: { tokenConfigured } };
}
