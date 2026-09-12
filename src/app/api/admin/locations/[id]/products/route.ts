import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { listLocationCatalog } from "@/modules/locations/features/list-location-catalog/list-location-catalog";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { createErrorResponse } from "@/shared/lib/http/error-response";

/**
 * Catálogo de un local (T8 fase 4).
 *
 * Devuelve **todos** los productos del negocio con la excepción del local al lado: el precio
 * base, el precio que cobra ese local, si está agotado ahí y si directamente no lo vende.
 * Leerlo lo puede hacer cualquier admin con sesión.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const result = await listLocationCatalog(id, {
      locationRepository: new PrismaLocationRepository(),
      menuRepository: new PrismaMenuRepository(),
    });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
