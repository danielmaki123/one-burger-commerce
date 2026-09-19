import { NextResponse } from "next/server";

import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { getCatalog } from "@/modules/menu/features/get-catalog/get-catalog";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * La carta pública. Es el **mismo** caso de uso que alimenta al mostrador, con `scope: "public"`: solo
 * lo disponible (salvo `includeUnavailable`), con el precio del local elegido y los bloques de
 * marketing.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const locationId = searchParams.get("locationId") ?? undefined;
    const includeUnavailable = searchParams.get("includeUnavailable") === "true";

    const result = await getCatalog(
      { scope: "public", categorySlug: category, locationId, includeUnavailable },
      {
        repository: new PrismaMenuRepository(),
        locationRepository: new PrismaLocationRepository(),
      },
    );

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const response = createErrorResponse(error);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
