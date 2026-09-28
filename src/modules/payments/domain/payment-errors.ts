import type { PaymentSnapshotError } from "@/modules/payments/domain/payment-snapshot";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el error del subsistema de dinero.
 *
 * Misma forma que los demás errores de dominio del repo (`OrderError`, `ShiftError`, `BankError`): `status`,
 * `code`, `message` y `fields`, para que la ruta lo mapee a una respuesta sin traducir nada a mano.
 *
 * Uno de sus códigos es especial y lo lee la capa de composición, no el usuario:
 * **`IDEMPOTENT_REPLAY`** significa «este request ya se cobró, devolvé el cobro que existe en vez de
 * escribir otro». La recuperación del choque de índice único se hace **fuera** de la transacción (un
 * `P2002` adentro aborta con `25P02`, ver `.agents/skills/money-change/SKILL.md` § CONCURRENCIA).
 */
export class PaymentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export const PAYMENT_ERROR_CODES = {
  /** El request ya se cobró: hay que devolver el `Payment` existente. */
  idempotentReplay: "IDEMPOTENT_REPLAY",
  duplicateIdempotencyKey: "P2002",
} as const;

/** Traduce el error del snapshot a un error de dominio con la forma de la ruta. */
export function paymentSnapshotToPaymentError(error: PaymentSnapshotError): PaymentError {
  return new PaymentError(422, "VALIDATION_ERROR", "Revisá el cobro.", {
    [error.field]: error.message,
  });
}
