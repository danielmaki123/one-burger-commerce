import { NextResponse } from "next/server";

import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { listKitchenOrders } from "@/modules/orders/features/list-kitchen-orders/list-kitchen-orders";
import { createErrorResponse } from "@/shared/lib/http/error-response";

import {
  assertCanOperateKitchen,
  resolveKitchenOrdersQuery,
} from "./kitchen-orders-composition";

/**
 * `GET /api/admin/kitchen/orders` — la cola de **Cocina**, la única puerta de la superficie
 * `/admin/kitchen`.
 *
 * Orquesta: sesión → **capacidad** (`canOperateKitchen`, en `kitchen-orders-composition`) → filtros y
 * alcance por sucursal → caso de uso. La autorización es de **servidor**, y la respuesta no lleva un solo
 * campo financiero: un rol sin capacidad financiera no puede leer la plata ni por API.
 *
 * La composición vive en `kitchen-orders-composition.ts` por el tope de líneas del handler y porque el
 * alcance se reusa del dominio de pedidos (`order-visibility`): **no** hay un segundo scope por sucursal.
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    assertCanOperateKitchen(session);

    const { searchParams } = new URL(request.url);
    const { filter } = resolveKitchenOrdersQuery(searchParams, session);

    const result = await listKitchenOrders(filter, {
      repository: new PrismaOrderRepository(),
      locationRepository: new PrismaLocationRepository(),
    });

    return NextResponse.json(result);
  } catch (error) {
    return createErrorResponse(error);
  }
}
