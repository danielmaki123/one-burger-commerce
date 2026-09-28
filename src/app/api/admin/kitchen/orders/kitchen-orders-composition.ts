import { z } from "zod";

import { canOperateKitchen } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import type { ListOrdersFilter } from "@/modules/orders/ports/order-repository";
import {
  resolveOrderListLocationIds,
  resolveOrderLocationScope,
} from "@/modules/orders/domain/order-visibility";

/**
 * La composición de la ruta de Cocina: **capacidad** y **alcance**, que son las dos cosas que el route
 * handler no debe saber resolver.
 *
 * Vive acá —y no dentro del handler— por dos motivos concretos: el handler se queda en su tope de líneas y
 * *orquesta* (valida, resuelve permisos, llama al caso de uso), y la regla de alcance se reusa del dominio
 * de pedidos en vez de reescribirse.
 */

/** Lo que la composición necesita de la sesión. Estructural a propósito: la sesión no expone un tipo. */
export type KitchenSession = {
  user: { role: AdminRole; locationIds?: readonly string[] | null };
};

/**
 * Los filtros que la cola de Cocina acepta.
 *
 * Sólo los estados del **tablero**: es una cola de cocina, no el historial del turno. Un valor que no
 * corresponde se **descarta** (no devuelve 400) y —esto es lo importante— se descarta **campo por
 * campo**: un `status` inválido no puede llevarse puestos la búsqueda ni el tipo, que sí eran válidos.
 * Una URL o un enlace viejo no puede dejar el tablero de la cocina en blanco.
 */
const typeSchema = z.enum(["delivery", "pickup", "table"]);
const statusSchema = z.enum([
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
]);
const searchSchema = z.string().trim().max(60);

function readFilter(params: URLSearchParams, key: string): string | undefined {
  return params.get(key)?.trim() || undefined;
}

/** Un valor que el esquema rechaza se cae; lo demás sigue. */
function usable<T>(schema: z.ZodType<T>, value: string | undefined): T | undefined {
  if (value === undefined) return undefined;

  const parsed = schema.safeParse(value);

  return parsed.success ? parsed.data : undefined;
}

export type KitchenOrdersQuery = {
  /** El filtro que recibe el caso de uso: los válidos + el alcance ya resuelto. */
  filter: ListOrdersFilter & { scopeLocationIds: string[] | null };
};

/**
 * La puerta de la superficie: sin `canOperateKitchen` **no hay cola**, aunque el rol pueda ver pedidos.
 *
 * 403 y no 404: el usuario está autenticado y su rol existe; lo que le falta es la **capacidad** de
 * operar cocina (`cashier` no cocina: `D-014`).
 */
export function assertCanOperateKitchen(session: KitchenSession): void {
  if (!canOperateKitchen(session.user.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

/**
 * Los filtros válidos + el alcance por sucursal.
 *
 * El alcance sale de `resolveOrderListLocationIds` —la misma función que usa la bandeja de Pedidos—, así
 * que una sucursal pedida **fuera del alcance no la muestra el filtro**: no hay un segundo scope.
 */
export function resolveKitchenOrdersQuery(
  params: URLSearchParams,
  session: KitchenSession,
): KitchenOrdersQuery {
  const filters = {
    type: usable(typeSchema, readFilter(params, "type")),
    status: usable(statusSchema, readFilter(params, "status")),
    search: usable(searchSchema, readFilter(params, "search")),
  };

  const scope = resolveOrderLocationScope({
    role: session.user.role,
    assignedLocationIds: session.user.locationIds,
  });

  return {
    filter: {
      ...filters,
      locationIds: resolveOrderListLocationIds({
        scope,
        requestedLocationId: params.get("locationId"),
      }),
      scopeLocationIds: scope.kind === "restricted" ? scope.locationIds : null,
    },
  };
}
