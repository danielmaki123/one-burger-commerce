import { z } from "zod";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { NotificationSettingsError } from "@/modules/notifications/domain/notification-settings-errors";

/**
 * Parte 3 del brief (alertas Telegram) — lo que comparten las rutas de la configuración.
 *
 * Vive acá y no en el `route.ts` porque el repo tiene un tope de 50 líneas por handler, y porque la puerta
 * de permisos es la misma regla en las dos rutas: **solo el dueño** configura o prueba Telegram.
 */
export const notificationSettingsPatchSchema = z.object({
  chatId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  eventsEnabled: z.array(z.string()).optional(),
  refundAlertThreshold: z.number().optional(),
  differenceAlertThreshold: z.number().nullable().optional(),
});

export function assertCanManageTelegram(role: AdminRole): void {
  if (!canManageBusinessSettings(role)) {
    throw new NotificationSettingsError(
      403,
      "FORBIDDEN",
      "Solo el dueño configura las alertas por Telegram.",
    );
  }
}

export function parseNotificationSettingsPatch(body: unknown) {
  const parsed = notificationSettingsPatchSchema.safeParse(body);

  if (!parsed.success) {
    throw new NotificationSettingsError(422, "VALIDATION_ERROR", "Revisá la configuración.", {
      chatId: parsed.error.issues[0]?.message ?? "Dato inválido.",
    });
  }

  return parsed.data;
}
