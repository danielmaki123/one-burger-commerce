import type { InvoiceRecord } from "../../domain/invoice";
import { InvoiceError } from "../../domain/invoice-errors";
import type { InvoiceRepository } from "../../ports/invoice-repository";

/**
 * Factura simple (2026-09-18) — leer la factura de un pedido.
 *
 * Devuelve el documento o `null` (todavía no se emitió): la pantalla necesita las dos cosas para mostrar la
 * factura o para ofrecer emitirla. Un pedido que no existe es 404, no una factura vacía.
 */
export async function getOrderInvoice(
  input: { orderId: string },
  deps: {
    invoiceRepository: InvoiceRepository;
    findOrder: (orderId: string) => Promise<{ id: string } | null>;
  },
): Promise<InvoiceRecord | null> {
  const order = await deps.findOrder(input.orderId);
  if (!order) {
    throw new InvoiceError(404, "NOT_FOUND", "Ese pedido no existe.", {
      order: "Ese pedido no existe.",
    });
  }

  return deps.invoiceRepository.findByOrderId(input.orderId);
}
