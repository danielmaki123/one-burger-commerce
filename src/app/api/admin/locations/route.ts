import { NextResponse } from "next/server";

import { canManageBusinessSettings } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { createLocation } from "@/modules/locations/features/create-location/create-location";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { parseLocationPayload } from "./location-payload";

/**
 * Locales del negocio (T8).
 *
 * Leer la lista lo puede hacer cualquier admin con sesión (la usan la pantalla de locales y
 * la de pedidos). Escribir es **configuración del negocio**: solo el owner, igual que
 * `/admin/settings`, porque de acá salen la dirección, el horario y si se aceptan pedidos.
 */
export async function GET() {
  try {
    await requireAdminSession();

    const repository = new PrismaLocationRepository();
    const locations = await repository.listLocations();

    return NextResponse.json({ data: locations });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageBusinessSettings(session.user.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        { status: 403 },
      );
    }

    const parsed = parseLocationPayload(await request.json().catch(() => ({})));
    if (!parsed.ok) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid payload", fields: parsed.fields } },
        { status: 400 },
      );
    }

    const repository = new PrismaLocationRepository();
    const result = await createLocation(parsed.input, { repository });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
