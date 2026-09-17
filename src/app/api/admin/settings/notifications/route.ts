import { NextResponse } from "next/server";

import { assertCanManageTelegram, parseNotificationSettingsPatch } from "./notifications-payload";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { getNotificationSettings } from "@/modules/notifications/features/get-notification-settings/get-notification-settings";
import { updateNotificationSettings } from "@/modules/notifications/features/update-notification-settings/update-notification-settings";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Parte 3 del brief (alertas Telegram) — leer y guardar la configuración del grupo.
 *
 * Solo el **owner** configura Telegram; el token del bot no se expone ni se cambia desde acá (vive en el
 * entorno) y la ruta solo dice si está puesto. Validación y permisos: `notifications-payload.ts`.
 */
export async function GET() {
  try {
    const session = await requireAdminSession();
    assertCanManageTelegram(session.user.role);

    const result = await getNotificationSettings(
      { repository: new PrismaNotificationSettingsRepository() },
      { tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()) },
    );

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    assertCanManageTelegram(session.user.role);

    const input = parseNotificationSettingsPatch(await request.json().catch(() => ({})));
    const result = await updateNotificationSettings(input, {
      repository: new PrismaNotificationSettingsRepository(),
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return createErrorResponse(error);
  }
}
