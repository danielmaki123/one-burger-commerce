import { NextResponse } from "next/server";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { TelegramHttpGateway } from "@/modules/notifications/adapters/telegram-http-gateway";
import { NotificationSettingsError } from "@/modules/notifications/domain/notification-settings-errors";
import { testTelegramConnection } from "@/modules/notifications/features/test-telegram-connection/test-telegram-connection";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";

/**
 * Parte 3 del brief (alertas Telegram) — «Probar conexión».
 *
 * Manda un mensaje **real** al grupo configurado (el brief lo pide explícitamente: sin simulación) y
 * guarda el resultado. Solo el dueño puede hacerlo, y si Telegram falla la respuesta trae el motivo
 * específico para que sepa qué arreglar; ninguna operación del negocio depende de esto.
 */
export async function POST() {
  try {
    const session = await requireAdminSession();

    if (!canManageBusinessSettings(session.user.role)) {
      throw new NotificationSettingsError(403, "FORBIDDEN", "Solo el dueño prueba las alertas.");
    }

    const result = await testTelegramConnection({
      repository: new PrismaNotificationSettingsRepository(),
      gateway: new TelegramHttpGateway({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        timeoutMs: Number(process.env.TELEGRAM_TIMEOUT_MS ?? 10000),
      }),
    });

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return createErrorResponse(error);
  }
}
