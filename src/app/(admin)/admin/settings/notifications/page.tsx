import { redirect } from "next/navigation";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { getNotificationSettings } from "@/modules/notifications/features/get-notification-settings/get-notification-settings";

import { AdminPageHeader } from "../../_components/admin-operational-ui";
import NotificationsClient from "./notifications-client";

/**
 * Parte 3 del brief (alertas Telegram) — la pantalla donde el owner configura su grupo.
 *
 * Solo el **dueño** entra (misma puerta que Personalización): es la pantalla que decide a dónde sale la
 * información del negocio. El **token del bot** no aparece ni se edita acá —vive en el entorno del
 * servidor—; lo que sí se ve es si está puesto, porque sin token no hay nada que probar.
 */
export default async function AdminNotificationSettingsPage() {
  const session = await requireAdminSession();

  if (!canManageBusinessSettings(session.user.role)) {
    redirect("/admin/orders");
  }

  const { data, meta } = await getNotificationSettings(
    { repository: new PrismaNotificationSettingsRepository() },
    { tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()) },
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Configuración"
        title="Alertas Telegram"
        description="Un recordatorio extra en tu grupo: turnos sin cerrar, devoluciones grandes, diferencias de caja y el resumen del día. La app sigue siendo la fuente de verdad."
      />

      <NotificationsClient initialSettings={data} tokenConfigured={meta.tokenConfigured} />
    </div>
  );
}
