import { OrderError } from "@/modules/orders/domain/order-errors";
import type { RefundRecord } from "@/modules/orders/domain/order.types";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — aprobar o rechazar una devolución.
 *
 * La devolución la **pide** quien atiende y la **resuelve** quien administra la caja: es el control que
 * evita que la misma persona devuelva plata y la firme. Tres reglas:
 *
 * 1. El estado tiene que estar **pendiente**: una devolución ya resuelta no se vuelve a resolver,
 *    porque cambiaría el arqueo de un turno que ya la había (o no) descontado.
 * 2. **Rechazar exige motivo**: sin razón, el cajero que devolvió no sabe qué hacer con la plata.
 * 3. La resolución queda **firmada** (quién y cuándo): es la parte auditable de la devolución.
 */
export async function reviewRefund(
  input: {
    refundId: string;
    decision: "approved" | "rejected";
    reviewedByUserId: string;
    note?: string | null;
  },
  {
    refundRepository,
    paymentRepository,
  }: {
    refundRepository: Pick<RefundRepository, "resolve"> & {
      findById(id: string): Promise<RefundRecord | null>;
    };
    /**
     * TASK-AUD-059 — el cobro de la devolución. Aprobar una devolución cuyo cobro se **anuló** descontaría
     * dos veces del arqueo: el cobro ya no cuenta y la devolución resta. Rechazarla sí se puede: es la
     * forma de dejar limpio el registro antes de corregir el cobro.
     */
    paymentRepository: Pick<PaymentRepository, "findPaymentById">;
  },
) {
  const refundId = input.refundId?.trim();
  if (!refundId) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", {
      refundId: "Requerido",
    });
  }

  const note = input.note?.trim() ?? null;
  if (input.decision === "rejected" && !note) {
    throw new OrderError(422, "VALIDATION_ERROR", "Escribí por qué rechazás la devolución.", {
      note: "El motivo del rechazo es obligatorio.",
    });
  }

  const refund = await refundRepository.findById(refundId);
  if (!refund) {
    throw new OrderError(404, "NOT_FOUND", "No encontramos esa devolución.");
  }

  if (refund.status !== "pending") {
    throw new OrderError(409, "CONFLICT", "Esa devolución ya está resuelta.");
  }

  if (input.decision === "approved") {
    const payment = await paymentRepository.findPaymentById(refund.paymentId);

    // Fail-closed: sin cobro no se puede saber si la devolución sigue teniendo respaldo. Con `Refund` en
    // cascada sobre `Payment` esto no debería pasar, y justamente por eso no se aprueba a ciegas.
    if (!payment) {
      throw new OrderError(409, "CONFLICT", "No encontramos el cobro de esa devolución.", {
        payment: "No encontramos el cobro de esa devolución.",
      });
    }

    if (payment.voidedAt !== null) {
      throw new OrderError(
        409,
        "CONFLICT",
        "El cobro de esa devolución está anulado: no hay plata que devolver.",
        { payment: "Ese cobro está anulado." },
      );
    }
  }

  const resolved = await refundRepository.resolve(refundId, {
    status: input.decision,
    approvedByUserId: input.reviewedByUserId,
    approvedAt: new Date().toISOString(),
    ...(note ? { reason: note } : {}),
  });

  if (!resolved) {
    throw new OrderError(409, "CONFLICT", "Esa devolución ya está resuelta.");
  }

  return { data: resolved };
}
