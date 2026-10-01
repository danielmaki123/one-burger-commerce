import { z } from "zod";

import {
  canCollectPayment,
  canViewOrderFinancials,
} from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { createProductionInvoiceDependencies } from "@/modules/invoices/adapters/production-invoice";
import { emitInvoice } from "@/modules/invoices/features/emit-invoice/emit-invoice";
import { getOrderInvoice } from "@/modules/invoices/features/get-order-invoice/get-order-invoice";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import type { AdminRole } from "@/modules/auth/domain/admin-role";

import { assertOrderInScope } from "../../order-scope";

/**
 * Factura simple (2026-09-18) — lo que la ruta del documento necesita resolver.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas y porque esto es la
 * composición (permiso, alcance, payload y caso de uso), no el handler.
 *
 * `TASK-ORDERS-RUNTIME-5B` (`A-70`) — **la puerta lateral que faltaba**. Antes:
 *
 * - el `GET` sólo exigía **sesión**: cualquier rol con cuenta leía la factura de un pedido de **otra
 *   sucursal**, y cocina —que no maneja plata— la leía y la imprimía;
 * - el `POST` usaba `canUsePOS` (la puerta **gruesa** del mostrador) en vez de la capacidad nominal del
 *   cobro;
 * - **ninguno** de los dos aplicaba el alcance por sucursal.
 *
 * Ahora la lectura exige `canViewOrderFinancials` —el documento **es** plata— y la emisión
 * `canCollectPayment`, que es la capacidad nominal de registrar un cobro, y las dos aplican el alcance. La
 * factura no se reforma: son sus puertas.
 */

const customerSchema = z
  .object({
    legalName: z.string().trim().max(120).nullable().optional(),
    taxId: z.string().trim().max(40).nullable().optional(),
  })
  .nullable()
  .optional();

/**
 * La sucursal del pedido, comprobada contra el alcance del usuario. Un pedido de otra sucursal no se lee ni
 * se factura, ni siquiera sabiendo el id.
 */
async function assertOrderInUserScope(input: {
  orderId: string;
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
}): Promise<void> {
  const order = await new PrismaOrderRepository().findOrderById(input.orderId);
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
}

export async function loadOrderInvoiceState(input: {
  orderId: string;
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
}) {
  if (!canViewOrderFinancials(input.role)) {
    throw new AuthError(403, "FORBIDDEN", "No tenés permiso para ver la factura.");
  }

  await assertOrderInUserScope(input);

  const { invoiceRepository, findOrder } = await createProductionInvoiceDependencies();
  const invoice = await getOrderInvoice({ orderId: input.orderId }, { invoiceRepository, findOrder });

  // Quien **cobra** puede emitir; quien cobra es también quien tiene la capacidad nominal del cobro.
  return { invoice, canEmit: canCollectPayment(input.role) };
}

export async function emitOrderInvoice(input: {
  orderId: string;
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  actorUserId: string;
  body: unknown;
}) {
  if (!canCollectPayment(input.role)) {
    throw new AuthError(403, "FORBIDDEN", "No tenés permiso para emitir la factura.");
  }

  await assertOrderInUserScope(input);

  const parsed = customerSchema.safeParse(input.body);
  const result = await emitInvoice(
    {
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      customer: parsed.success ? parsed.data : null,
    },
    await createProductionInvoiceDependencies(),
  );

  return { invoice: result.invoice, reused: result.reused };
}
