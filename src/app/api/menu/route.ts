import { NextResponse } from "next/server";

import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { getPublicMenu } from "@/modules/menu/features/get-public-menu/get-public-menu";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const locationId = searchParams.get("locationId") ?? undefined;
    const includeUnavailable = searchParams.get("includeUnavailable") === "true";

    const repository = new PrismaMenuRepository();
    const result = await getPublicMenu(
      { category, locationId, includeUnavailable },
      { repository },
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
