import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaInventoryRepository } from "@/modules/inventory/adapters/prisma-inventory-repository";
import { listInventoryAlerts } from "@/modules/inventory/features/list-inventory-alerts/list-inventory-alerts";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export async function GET() {
  try {
    await requireAdminSession();

    const repository = new PrismaInventoryRepository();
    const result = await listInventoryAlerts({ repository });
    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
