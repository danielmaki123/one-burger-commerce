import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { canVoidPayment } from "@/modules/auth/domain/admin-permissions";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";
import { validatePaymentVoidReason } from "@/modules/orders/domain/payment-void";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";

/**
 * TASK-AUD-059 — **anular un cobro** (alcance remanente de A-15).
 *
 * El cobro mal registrado —duplicado, con el monto cambiado, con el medio equivocado— no se borra ni se
 * edita: se marca con cuándo, quién y por qué, y deja de contar para el arqueo, para el saldo del pedido y
 * para la conciliación. Es lo que cierra el hueco de A-15 por el otro lado: la **devolución** registra la
 * plata que salió del cajón; esto corrige un registro que no debía existir.
 *
 * Cuatro reglas, en este orden:
 *
 * 1. **Solo el dueño** (`canVoidPayment`): es una decisión sobre el arqueo, no una devolución.
 * 2. **Motivo obligatorio**: la anulación sin motivo no se puede auditar seis meses después.
 * 3. **No se anula lo que tiene una devolución viva** (pendiente o aprobada). Una devolución mueve plata:
 *    si además el cobro desapareciera, esa plata se descontaría dos veces del arqueo. Primero se resuelve
 *    la devolución (rechazarla) y después se corrige el cobro.
 * 4. **Una sola vez**: el segundo intento es un conflicto, y el motivo firmado no se reescribe.
 *
 * El **límite atómico** es la transacción del alcance (`runInVoidPaymentTransaction`): leer el cobro,
 * comprobar que no tenga devoluciones vivas y marcarlo pasan todo junto o no pasan. La guarda de la
 * carrera está en el propio `WHERE` del adaptador (`voidedAt: null`), no en el `if` de la lectura.
 */
export type VoidPaymentScope = {
  paymentRepository: Pick<PaymentRepository, "findPaymentById" | "voidPayment">;
  /**
   * Las devoluciones del cobro. Se leen con el **mismo** cliente de la transacción: una devolución
   * aprobada un instante antes de la anulación tiene que verse acá.
   */
  refundRepository: Pick<RefundRepository, "listByPayment">;
};

export type VoidPaymentDependencies = {
  runInVoidPaymentTransaction: <T>(work: (scope: VoidPaymentScope) => Promise<T>) => Promise<T>;
  /**
   * El asiento de la acción sensible. Es **best-effort** (contrato de `recordAuditAction`): el rastro
   * durable de esta operación es la propia fila del cobro —`voidedAt`/`voidedByUserId`/`voidReason`—,
   * que se escribe dentro de la transacción; el log es su copia indexable.
   */
  recordVoidAudit: (input: {
    paymentId: string;
    orderId: string;
    amount: number;
    currency: string;
    method: PaymentMethodType;
    reason: string;
    actorUserId: string;
  }) => Promise<unknown>;
  /** El instante de la firma. Inyectable para que el test fije la hora. */
  now?: () => Date;
};

export async function voidPayment(
  input: {
    paymentId: string;
    actorRole: AdminRole;
    actorUserId: string;
    reason?: unknown;
  },
  dependencies: VoidPaymentDependencies,
): Promise<{ data: PaymentRecord }> {
  if (!canVoidPayment(input.actorRole)) {
    throw new OrderError(403, "FORBIDDEN", "Solo el dueño puede anular un cobro.");
  }

  const paymentId = input.paymentId?.trim();
  if (!paymentId) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid payload", { paymentId: "Requerido" });
  }

  const check = validatePaymentVoidReason({ reason: input.reason });

  if (!check.ok) {
    throw new OrderError(422, "VALIDATION_ERROR", check.message, { reason: check.message });
  }

  const voidedAt = (dependencies.now ?? (() => new Date()))();

  const voided = await dependencies.runInVoidPaymentTransaction(async (scope) => {
    const payment = await scope.paymentRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new OrderError(404, "NOT_FOUND", "No encontramos ese cobro.", {
        payment: "No encontramos ese cobro.",
      });
    }

    if (payment.voidedAt !== null) {
      throw new OrderError(409, "CONFLICT", "Ese cobro ya está anulado.", {
        payment: "Ese cobro ya está anulado.",
      });
    }

    const refunds = await scope.refundRepository.listByPayment(payment.id);
    const live = refunds.filter((refund) => refund.status !== "rejected");

    if (live.length > 0) {
      throw new OrderError(
        409,
        "CONFLICT",
        "Ese cobro tiene una devolución en curso (o aprobada): resolvela antes de anularlo.",
        { payment: "Ese cobro tiene una devolución sin resolver." },
      );
    }

    const marked = await scope.paymentRepository.voidPayment(payment.id, {
      reason: check.reason,
      actorUserId: input.actorUserId,
      voidedAt: voidedAt.toISOString(),
    });

    // Otra anulación ganó la carrera entre la lectura y la escritura: la guarda está en la base.
    if (!marked) {
      throw new OrderError(409, "CONFLICT", "Ese cobro ya está anulado.", {
        payment: "Ese cobro ya está anulado.",
      });
    }

    return marked;
  });

  try {
    await dependencies.recordVoidAudit({
      paymentId: voided.id,
      orderId: voided.orderId,
      amount: voided.amount,
      currency: voided.currency ?? "",
      method: voided.method,
      reason: check.reason,
      actorUserId: input.actorUserId,
    });
  } catch {
    // La anulación ya está firmada en la fila: el asiento no la deshace.
  }

  return { data: voided };
}
