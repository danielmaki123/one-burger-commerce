import type { PaymentMethodKind, PaymentMethodType } from "@/modules/orders/domain/order.types";
import { PAYMENT_METHOD_KINDS } from "@/modules/payments/domain/payment-snapshot";

export type { PaymentMethodKind };

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-017`) — **la correspondencia entre el enum histórico del cobro y el
 * tipo canónico**.
 *
 * Los dos nombran cosas distintas y por eso los dos existen:
 *
 * - `PaymentMethodType` es el enum **histórico** del cobro (`cash` · `card` · `transfer` · `mixed` ·
 *   `other`). Se conserva tal como está —una fila con `mixed` puede existir en la base y **no** se
 *   reescribe— y es lo que se guarda en `Payment.method`.
 * - `PaymentMethodKind` es la **semántica contable** configurable (`cash` · `card` · `bank_transfer` ·
 *   `wallet` · `other`), la que el dueño administra en `/admin/finance`. El hecho la congela junto al medio
 *   para poder explicarse aunque el medio se renombre o cambie de tipo.
 *
 * `mixed` **no** es un tipo canónico: se deriva de más de un `Payment` (`D-017`). Si alguna vez llega acá
 * —una fila vieja, un payload fuera de contrato— cae en `other`, que es el escape explícito, y **nunca** se
 * inventa un tipo.
 */
const KIND_BY_METHOD: Record<PaymentMethodType, PaymentMethodKind> = {
  cash: "cash",
  card: "card",
  transfer: "bank_transfer",
  mixed: "other",
  other: "other",
};

export function paymentMethodKindFor(method: PaymentMethodType): PaymentMethodKind {
  return KIND_BY_METHOD[method] ?? "other";
}

/** El tipo canónico que el catálogo manda, si es válido. Un valor raro no se propaga al hecho. */
export function assertPaymentMethodKind(value: string): PaymentMethodKind {
  return (PAYMENT_METHOD_KINDS as readonly string[]).includes(value)
    ? (value as PaymentMethodKind)
    : "other";
}
