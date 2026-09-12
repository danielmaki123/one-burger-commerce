import { NextResponse } from "next/server";

import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { listPublicLocations } from "@/modules/locations/features/list-public-locations/list-public-locations";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Locales para el checkout (T8 fase 6).
 *
 * Es público: el cliente necesita saber dónde retira y en qué horario. Solo devuelve los
 * locales activos y solo los datos del punto de retiro.
 */
export async function GET() {
  try {
    const result = await listPublicLocations({ repository: new PrismaLocationRepository() });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
