import { OrderError } from "@/modules/orders/domain/order-errors";
import type { RefundRecord } from "@/modules/orders/domain/order.types";
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
  }: {
    refundRepository: Pick<RefundRepository, "resolve"> & {
      findById(id: string): Promise<RefundRecord | null>;
    };
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
