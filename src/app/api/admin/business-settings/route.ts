import { NextResponse } from "next/server";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { getBusinessSettings } from "@/modules/business-settings/features/get-business-settings/get-business-settings";
import { updateBusinessSettings } from "@/modules/business-settings/features/update-business-settings/update-business-settings";
import { createErrorResponse } from "@/shared/lib/http/error-response";

function forbiddenResponse() {
  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "No tenés permiso para cambiar la personalización del negocio",
      },
    },
    { status: 403 },
  );
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (!canManageBusinessSettings(session.user.role)) {
      return forbiddenResponse();
    }

    const settings = await getBusinessSettings({
      repository: new PrismaBusinessSettingsRepository(),
    });

    return NextResponse.json(settings);
  } catch (error) {
    return createErrorResponse(error);
  }
}

/**
 * Guarda la configuración del negocio.
 *
 * Las rutas públicas son `force-dynamic` y leen con `cache()` por request, así
 * que no hace falta invalidar ningún cache: el cambio se ve en la siguiente
 * carga. La validación y la auditoría (`updatedByUserId`) las resuelve el caso
 * de uso.
 */
export async function PUT(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageBusinessSettings(session.user.role)) {
      return forbiddenResponse();
    }

    const payload = await request.json().catch(() => null);
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "El cuerpo del pedido tiene que ser un objeto JSON",
          },
        },
        { status: 400 },
      );
    }

    const settings = await updateBusinessSettings(payload, {
      repository: new PrismaBusinessSettingsRepository(),
      updatedByUserId: session.user.id,
    });

    return NextResponse.json(settings);
  } catch (error) {
    return createErrorResponse(error);
  }
}
