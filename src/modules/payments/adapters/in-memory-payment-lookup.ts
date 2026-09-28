import type { PaymentRecord } from "@/modules/orders/domain/order.types";

import type { PaymentLookup } from "@/modules/payments/ports/payment-lookup";

/** Lo mínimo que el doble necesita del repositorio: sus filas. */
type PaymentStore = { payments: PaymentRecord[] };

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-71`) — el doble de la búsqueda por clave de idempotencia.
 *
 * Implementa el puerto **completo** y comparte el arreglo de cobros del repositorio en memoria, para que el
 * doble no mienta distinto que la base: si el caso de uso escribió el cobro, esta búsqueda lo encuentra.
 */
export class InMemoryPaymentLookup implements PaymentLookup {
  constructor(private readonly store: PaymentStore) {}

  async findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null> {
    const normalized = key.trim();
    if (normalized.length === 0) return null;

    return (
      this.store.payments.find((payment) => payment.idempotencyKey === normalized) ?? null
    );
  }
}
