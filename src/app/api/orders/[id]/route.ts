import { NextResponse } from "next/server";

import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { getPublicOrder } from "@/modules/orders/features/get-order/get-public-order";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const repository = new PrismaOrderRepository();
    const result = await getPublicOrder(id, token, { repository });
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
