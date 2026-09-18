import { z } from "zod";

import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { createProductionInvoiceDependencies } from "@/modules/invoices/adapters/production-invoice";
import { emitInvoice } from "@/modules/invoices/features/emit-invoice/emit-invoice";
import { getOrderInvoice } from "@/modules/invoices/features/get-order-invoice/get-order-invoice";
import type { AdminRole } from "@/modules/auth/domain/admin-role";

/**
 * Factura simple (2026-09-18) — lo que la ruta del documento necesita resolver.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas y esto es la composición
 * (permiso, payload y caso de uso), no el handler. Quien entrega el documento es quien cobra: el permiso es
 * el del POS (dueño, gerente y cajero), y la pantalla no ofrece el botón a quien no puede.
 */

const customerSchema = z
  .object({
    legalName: z.string().trim().max(120).nullable().optional(),
    taxId: z.string().trim().max(40).nullable().optional(),
  })
  .nullable()
  .optional();

export async function loadOrderInvoiceState(input: { orderId: string; role: AdminRole }) {
  const { invoiceRepository, findOrder } = await createProductionInvoiceDependencies();
  const invoice = await getOrderInvoice({ orderId: input.orderId }, { invoiceRepository, findOrder });

  return { invoice, canEmit: canUsePOS(input.role) };
}

export async function emitOrderInvoice(input: {
  orderId: string;
  role: AdminRole;
  actorUserId: string;
  body: unknown;
}) {
  if (!canUsePOS(input.role)) {
    throw new AuthError(403, "FORBIDDEN", "No tenés permiso para emitir la factura.");
  }

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
