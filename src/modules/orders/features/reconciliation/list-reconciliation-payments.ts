import {
  isReconciliationMethod,
  summarizeReconciliation,
} from "@/modules/orders/domain/payment-reconciliation";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";

/**
 * Tarea 10 del brief (2026-09-17) — **los cobros del día que se concilian** (11.1/11.2).
 *
 * Trae los cobros del local en la ventana del día del negocio y los parte en dos: los de **tarjeta y
 * transferencia** —lo que se exporta y se compara contra el lote de la terminal y el extracto del banco— y
 * el resumen, que además informa lo que no entra en el export (mixto y otro). El efectivo no aparece: su
 * cuadre es el arqueo del cajón.
 *
 * El orden es del más viejo al más nuevo, que es como se leen el lote y el extracto.
 */
export async function listReconciliationPayments(
  input: { locationId: string; from?: string; to?: string; baseCurrencyCode: string },
  { paymentRepository }: { paymentRepository: PaymentRepository },
) {
  const payments = await paymentRepository.listPaymentsInRange(input.locationId, {
    from: input.from,
    to: input.to,
  });

  return {
    data: {
      payments: payments
        .filter((payment) => isReconciliationMethod(payment.method))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      summary: summarizeReconciliation(payments, {
        baseCurrencyCode: input.baseCurrencyCode,
      }),
    },
  };
}
