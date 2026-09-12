import { NextResponse } from "next/server";
import { z } from "zod";

import { canViewAdminOverview } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { getBusinessSettings } from "@/modules/business-settings/features/get-business-settings/get-business-settings";
import { getAdminOverviewPerformance } from "@/modules/dashboard/features/get-admin-overview-performance/get-admin-overview-performance";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const querySchema = z.object({
  period: z.enum(["today", "7d", "30d", "month"]).default("7d"),
  channel: z.enum(["all", "delivery", "pickup"]).default("all"),
});

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canViewAdminOverview(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
      channel: searchParams.get("channel") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query params",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(
                ([key, messages]) => [
                  key,
                  Array.isArray(messages) ? messages[0] : String(messages),
                ],
              ),
            ),
          },
        },
        { status: 400 },
      );
    }

    // El día del tablero es el del negocio (T8/fase de zona horaria), no una zona fija.
    const settings = await getBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });

    return NextResponse.json(
      await getAdminOverviewPerformance(
        parsed.data.period,
        parsed.data.channel,
        settings.timezone,
      ),
    );
  } catch (error) {
    return createErrorResponse(error);
  }
}
