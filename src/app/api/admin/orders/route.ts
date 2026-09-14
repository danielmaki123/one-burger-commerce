import { NextResponse } from "next/server";
import { z } from "zod";

import { canManageOrderOperations } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import {
  resolveOrderListLocationIds,
  resolveOrderLocationScope,
} from "@/modules/orders/domain/order-visibility";
import { listAdminOrders } from "@/modules/orders/features/list-admin-orders/list-admin-orders";
import { createErrorResponse } from "@/shared/lib/http/error-response";

const querySchema = z.object({
  type: z.enum(["delivery", "pickup", "table"]).optional(),
  status: z
    .enum([
      "new",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "closed",
      "ready_for_pickup",
      "picked_up",
      "accepted",
      "served",
      "cancelled",
    ])
    .optional(),
  dateFrom: z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: "Invalid date",
    }),
  dateTo: z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: "Invalid date",
    }),
  // Local del pedido (T8): cada sucursal ve lo suyo; sin dato, todos.
  locationId: z.string().optional(),
  // B4: búsqueda por número, nombre, WhatsApp o PIN. Se recorta y se topa: un término enorme no tiene
  // por qué llegar a la base.
  search: z.string().trim().max(60).optional(),
  // B4: la caja necesita ver solo lo que se paga en efectivo (es donde hay vuelto que preparar).
  // Las formas de pago son las del dominio (`OrderPaymentMethod`).
  paymentMethod: z.enum(["cash", "card"]).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    if (!canManageOrderOperations(session.user.role)) {
      throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      type: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      paymentMethod: searchParams.get("paymentMethod") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "Invalid query params",
            fields: Object.fromEntries(
              Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [
                k,
                Array.isArray(v) ? v[0] : String(v),
              ]),
            ),
          },
        },
        { status: 400 },
      );
    }

    // El filtro por local **se lee** (antes viajaba en la query y la ruta lo ignoraba: el control
    // era decorativo) y pasa por el alcance del usuario: pedir una sucursal ajena no la muestra.
    const scope = resolveOrderLocationScope({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    });
    const locationIds = resolveOrderListLocationIds({
      scope,
      requestedLocationId: searchParams.get("locationId"),
    });

    const repository = new PrismaOrderRepository();
    const result = await listAdminOrders(
      { ...parsed.data, locationIds },
      {
        repository,
        locationRepository: new PrismaLocationRepository(),
      },
    );

    // El alcance del usuario viaja en `meta` para que la pantalla no reimplemente la regla (A).
    // Ojo: `locationIds` es el filtro **aplicado** (lo que se pidió, si está permitido) y
    // `locationScope` es lo que el usuario **puede** ver (`null` = todas). La pantalla usa el
    // segundo para dibujar el filtro: con el primero, elegir una sucursal lo dejaba con una sola
    // opción y el control desaparecía.
    return NextResponse.json({
      ...result,
      meta: {
        ...result.meta,
        locationIds,
        locationScope: scope.kind === "restricted" ? scope.locationIds : null,
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
