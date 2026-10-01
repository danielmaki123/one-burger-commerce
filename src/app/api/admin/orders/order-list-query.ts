import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ADMIN_ORDER_DATE_PRESETS,
  ADMIN_ORDER_PAYMENT_FILTERS,
  ADMIN_ORDER_STATUS_GROUPS,
  resolveAdminOrderRange,
  resolveAdminOrderStatusGroup,
  type AdminOrderDatePreset,
  type AdminOrderPaymentFilter,
  type AdminOrderStatusGroup,
} from "@/modules/orders/domain/admin-order-filters";
import {
  resolveOrderListLocationIds,
  type OrderLocationScope,
} from "@/modules/orders/domain/order-visibility";
import type { ListAdminOrdersFilter } from "@/modules/orders/features/list-admin-orders/list-admin-orders";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **los siete filtros de la URL**, validados y compuestos.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas y porque esto es
 * composición, no orquestación: traduce el vocabulario de la URL (`date=today`, `status=ready`,
 * `scheduled=1`) a los filtros del caso de uso y le aplica el **alcance del usuario**.
 *
 * La lista de valores válidos es la del **dominio** (`admin-order-filters`), no una copia: si mañana se
 * agrega un rango de fecha, se agrega en el dominio y esta capa lo acepta sola.
 *
 * **La fecha es la del negocio**: `date=today` se traduce a la ventana del día natural en la zona
 * configurada (`A-63`), no a la del servidor ni a la del navegador.
 */

const querySchema = z.object({
  search: z.string().trim().max(60).optional(),
  date: z.enum(ADMIN_ORDER_DATE_PRESETS).optional(),
  locationId: z.string().trim().min(1).max(60).optional(),
  status: z.enum(ADMIN_ORDER_STATUS_GROUPS).optional(),
  payment: z.enum(ADMIN_ORDER_PAYMENT_FILTERS).optional(),
  // `scheduled=1` (o `true`): el control de la referencia es un flag, no un valor libre.
  scheduled: z.enum(["1", "true", "0", "false"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export type OrderListQuery = z.infer<typeof querySchema>;

export function parseOrderListQuery(searchParams: URLSearchParams):
  | { ok: true; query: OrderListQuery }
  | { ok: false; response: NextResponse } {
  const parsed = querySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    locationId: searchParams.get("locationId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    payment: searchParams.get("payment") ?? undefined,
    scheduled: searchParams.get("scheduled") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (parsed.success) return { ok: true, query: parsed.data };

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid query params",
          fields: Object.fromEntries(
            Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
              key,
              Array.isArray(value) ? value[0] : String(value),
            ]),
          ),
        },
      },
      { status: 400 },
    ),
  };
}

/**
 * El filtro del caso de uso, con el alcance del usuario ya aplicado.
 *
 * El local pedido pasa por `resolveOrderListLocationIds`: pedir la sucursal ajena **no la muestra** (se
 * devuelve el alcance completo). La lógica del alcance es del dominio de pedidos y no se reescribe acá.
 */
export function buildOrderListFilter(input: {
  query: OrderListQuery;
  scope: OrderLocationScope;
  timeZone: string;
  now: Date;
}): ListAdminOrdersFilter {
  const statusGroup: AdminOrderStatusGroup = input.query.status ?? "all";
  const payment: AdminOrderPaymentFilter = input.query.payment ?? "all";
  const preset: AdminOrderDatePreset | null = input.query.date ?? null;
  const range = resolveAdminOrderRange({ preset, timeZone: input.timeZone, now: input.now });

  return {
    statuses: resolveAdminOrderStatusGroup(statusGroup),
    dateFrom: range.from,
    dateTo: range.to,
    locationIds: resolveOrderListLocationIds({
      scope: input.scope,
      requestedLocationId: input.query.locationId,
    }),
    search: input.query.search,
    scheduledOnly: input.query.scheduled === "1" || input.query.scheduled === "true",
    payment,
    page: input.query.page,
    pageSize: input.query.pageSize,
  };
}
