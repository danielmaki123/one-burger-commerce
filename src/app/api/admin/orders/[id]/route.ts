import { NextResponse } from "next/server";

import { canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { getOrder } from "@/modules/orders/features/get-order/get-order";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import { assertOrderInScope } from "../order-scope";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    if (!canManageOrderOperations(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { id } = await params;
    const repository = new PrismaOrderRepository();
    const locationRepository = new PrismaLocationRepository();
    const paymentRepository = new PrismaPaymentRepository();
    const result = await getOrder(id, { repository, locationRepository, paymentRepository });

    // A: un pedido de otra sucursal no se abre ni por URL directa.
    assertOrderInScope(
      resolveOrderLocationScope({
        role: session.user.role,
        assignedLocationIds: session.user.locationIds,
      }),
      result.data.locationId,
    );

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
