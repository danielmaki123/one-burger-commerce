import { z } from "zod";

import { InvoiceError } from "@/modules/invoices/domain/invoice-errors";
import { INVOICE_VOID_NOTE_MAX_LENGTH } from "@/modules/invoices/domain/invoice-void";

/**
 * Punto 2 del roadmap (2026-09-18) — el payload de la anulación.
 *
 * Es deliberadamente **laxo**: exige que haya un motivo y una nota con forma de texto, y deja la
 * decisión de qué motivos existen en el dominio (`validateInvoiceVoidReason`), que es el único lugar
 * donde vive la lista cerrada. Así el error que ve la persona es el mismo lo mande la pantalla o
 * cualquiera que llame a la API.
 */

const voidSchema = z.object({
  reason: z.string().trim().min(1, "Elegí un motivo de la lista para anular la factura."),
  note: z.string().trim().max(INVOICE_VOID_NOTE_MAX_LENGTH).optional(),
});

export function parseVoidInvoicePayload(body: unknown): { reason: string; note?: string } {
  const parsed = voidSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Elegí un motivo de la lista para anular la factura.";

    throw new InvoiceError(422, "VALIDATION_ERROR", message, { reason: message });
  }

  return parsed.data;
}
