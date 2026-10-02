import { z } from "zod";

import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { OrderRecord, OrderStatus } from "@/modules/orders/domain/order.types";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import type { AdminRole } from "@/modules/auth/domain/admin-role";

import { assertOrderInScope } from "./order-scope";
import {
  assertCanChangeOrderStatus,
  assertDeliverableByRole,
} from "./order-status-authorization";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` — **lo que un cambio de estado necesita resolverse antes de mutar**:
 * el payload, el pedido, el alcance y la capacidad.
 *
 * Vive acá y no en el `route.ts` porque el repo tiene un tope de 50 líneas por handler y porque esta ruta
 * es **legacy con techo medido** (107 líneas): mover el preámbulo a composición es lo que permite agregar la
 * puerta nominal de la entrega sin **subir** ese techo. El handler queda como lo que tiene que ser —validar,
 * resolver permisos, llamar a la composición— y la secuencia queda en un solo lugar.
 *
 * El **orden de las cuatro decisiones** es parte de la corrección:
 *
 * 1. **El payload** primero: un body inválido no merece una lectura de base.
 * 2. **La capacidad** después (`assertCanChangeOrderStatus`): el `cashier` entra por la puerta **nominal** de
 *    la entrega, no por la gruesa (brief §19).
 * 3. **El alcance** con el pedido ya leído: un pedido de otra sucursal no se toca, y el 403 sale antes de
 *    cualquier escritura.
 * 4. **La transición real** al final (`assertDeliverableByRole`): un rol sin la capacidad gruesa **sólo**
 *    puede firmar `ready_for_pickup → picked_up`, y eso depende del estado del pedido, no del pedido de body.
 *
 * Devolver `{ ok: false, response }` en vez de lanzar existe para el **400/422 del payload**, que son errores
 * de forma y no de permiso: la ruta los devuelve tal como están y el resto sigue siendo excepciones.
 */

const statusSchema = z.object({
  status: z.enum([
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
  ]),
  note: z.string().nullable().optional(),
});

export type OrderStatusChangeRequest = {
  status: OrderStatus;
  note: string | null;
};

export type OrderStatusChangeContext = {
  request: OrderStatusChangeRequest;
  /** El pedido ya leído y autorizado: la composición lo usa para la capacidad de Cocina y el alcance. */
  order: OrderRecord;
};

export type OrderStatusChangeResolution =
  | { ok: true; context: OrderStatusChangeContext }
  | { ok: false; status: number; body: unknown };

/** El `fields` del error de payload, con el mismo formato que devuelve el resto del panel. */
function payloadFields(issues: z.ZodIssue[]): Record<string, string> {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

export async function resolveOrderStatusChange(input: {
  body: unknown;
  orderId: string;
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  repository: { findOrderById: (id: string) => Promise<OrderRecord | null> };
}): Promise<OrderStatusChangeResolution> {
  const parsed = statusSchema.safeParse(input.body);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: {
          code: "BAD_REQUEST",
          message: "Invalid payload",
          fields: payloadFields(parsed.error.issues),
        },
      },
    };
  }

  assertCanChangeOrderStatus(input.role);

  if (parsed.data.status === "cancelled" && !parsed.data.note?.trim()) {
    return {
      ok: false,
      status: 422,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid payload",
          fields: { note: "Required when status is cancelled" },
        },
      },
    };
  }

  // A: el alcance se comprueba **antes** de mutar; un pedido de otra sucursal no se toca.
  const order = await input.repository.findOrderById(input.orderId);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  assertOrderInScope(
    resolveOrderLocationScope({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
    }),
    order.locationId,
  );

  assertDeliverableByRole({
    role: input.role,
    type: order.type,
    current: order.status,
    next: parsed.data.status,
  });

  return {
    ok: true,
    context: {
      request: { status: parsed.data.status, note: parsed.data.note ?? null },
      order,
    },
  };
}

/** La composición de producción: el repositorio real, para que el handler no instancie Prisma. */
export function createOrderStatusRepository() {
  return new PrismaOrderRepository();
}
