import type { AdminRole } from "@/modules/auth/domain/admin-role";

import { InvoiceError } from "../../domain/invoice-errors";
import type { InvoiceRecord } from "../../domain/invoice";
import { validateInvoiceVoidReason } from "../../domain/invoice-void";
import type { InvoiceRepository, VoidInvoiceInput } from "../../ports/invoice-repository";

/**
 * Punto 2 del roadmap (2026-09-18) — anular una factura emitida.
 *
 * Cuatro reglas, en este orden: **solo el dueño** (una factura anulada es un documento que ya salió del
 * negocio), **motivo obligatorio** de la lista cerrada —«Otro» con su texto—, la factura **no se borra**
 * (se marca con cuándo, quién y por qué) y queda el **asiento** en el log de acciones sensibles. El
 * asiento no tumba la anulación: si el log falla, la factura ya está anulada y el caso de uso no vuelve
 * atrás por un registro.
 */
export type VoidInvoiceDependencies = {
  invoiceRepository: Pick<InvoiceRepository, "findById" | "void">;
  recordVoidAudit: (input: {
    invoiceId: string;
    reason: string;
    note: string | null;
    actorUserId: string;
  }) => Promise<unknown>;
  now?: () => Date;
};

export async function voidInvoice(
  input: {
    invoiceId: string;
    actorRole: AdminRole;
    actorUserId: string;
    reason?: unknown;
    note?: unknown;
  },
  dependencies: VoidInvoiceDependencies,
): Promise<InvoiceRecord> {
  if (input.actorRole !== "owner") {
    throw new InvoiceError(403, "FORBIDDEN", "Solo el dueño puede anular una factura.");
  }

  const check = validateInvoiceVoidReason({ reason: input.reason, note: input.note });

  if (!check.ok) {
    throw new InvoiceError(400, "INVALID_REASON", check.message, { reason: check.message });
  }

  const invoice = await dependencies.invoiceRepository.findById(input.invoiceId);

  if (!invoice) {
    throw new InvoiceError(404, "NOT_FOUND", "No encontramos esa factura.");
  }

  if (invoice.status === "voided") {
    throw new InvoiceError(409, "ALREADY_VOIDED", "Esa factura ya está anulada.");
  }

  const voidedAt = (dependencies.now ?? (() => new Date()))();
  const voidInput: VoidInvoiceInput = {
    reason: check.reason,
    actorUserId: input.actorUserId,
    voidedAt,
  };

  const voided = await dependencies.invoiceRepository.void(invoice.id, voidInput);

  try {
    await dependencies.recordVoidAudit({
      invoiceId: invoice.id,
      reason: check.reason,
      note: check.note,
      actorUserId: input.actorUserId,
    });
  } catch {
    // La factura ya está anulada: el asiento es importante, pero no deshace el documento.
  }

  return voided;
}
