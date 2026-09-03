import { NextResponse } from "next/server";

import { PrismaDeliveryZoneRepository } from "@/modules/orders/adapters/prisma-delivery-zone-repository";
import { listPublicDeliveryZones } from "@/modules/orders/features/list-public-delivery-zones/list-public-delivery-zones";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const repository = new PrismaDeliveryZoneRepository();
    const result = await listPublicDeliveryZones({ repository });
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
