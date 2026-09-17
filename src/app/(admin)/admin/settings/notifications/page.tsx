import { redirect } from "next/navigation";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { TelegramHttpGateway } from "@/modules/notifications/adapters/telegram-http-gateway";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { getNotificationSettings } from "@/modules/notifications/features/get-notification-settings/get-notification-settings";
import { getTelegramBotIdentity } from "@/modules/notifications/features/get-telegram-bot-identity/get-telegram-bot-identity";
import { listTelegramAlertHistory } from "@/modules/notifications/features/list-telegram-alert-history/list-telegram-alert-history";

import { AdminPageHeader } from "../../_components/admin-operational-ui";
import NotificationsClient from "./notifications-client";

/**
 * Parte 3 del brief + decisión del owner (2026-09-17) — la pantalla de **alertas**.
 *
 * Solo el **dueño** entra (es la pantalla que decide a dónde sale la información del negocio). El **token
 * del bot** no aparece ni se edita acá —vive en el entorno del servidor—; lo que sí se ve es si está
 * puesto y **con qué bot** (su `@usuario`), porque el dueño tiene más de uno en Telegram.
 *
 * Las dos lecturas que no son configuración se resuelven acá y bajan como **datos** al cliente: quién es el
 * bot (una llamada a Telegram, best-effort) y los **últimos envíos** (del outbox, que es donde el sistema
 * ya anota qué intentó mandar). Así el panel no tiene que pedir nada al abrirse.
 */
export default async function AdminNotificationSettingsPage() {
  const session = await requireAdminSession();

  if (!canManageBusinessSettings(session.user.role)) {
    redirect("/admin/orders");
  }

  const tokenConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const { data, meta } = await getNotificationSettings(
    { repository: new PrismaNotificationSettingsRepository() },
    { tokenConfigured },
  );

  const [{ data: bot }, { data: history }] = await Promise.all([
    tokenConfigured
      ? getTelegramBotIdentity({
          gateway: new TelegramHttpGateway({ botToken: process.env.TELEGRAM_BOT_TOKEN }),
        })
      : Promise.resolve({ data: { username: null } }),
    listTelegramAlertHistory({ limit: 20 }, { outboxRepository: new PrismaOutboxRepository() }),
  ]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Configuración"
        title="Alertas"
        description="Notificaciones al dueño por Telegram"
      />

      <NotificationsClient
        initialSettings={data}
        tokenConfigured={meta.tokenConfigured}
        botUsername={bot.username}
        history={history}
      />
    </div>
  );
}
