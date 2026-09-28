import type { PaymentRecord } from "@/modules/orders/domain/order.types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-71`) — **buscar un cobro por su clave de idempotencia**.
 *
 * Es un puerto propio de `payments` y no un método del repositorio de cobros porque tiene otro rol: no es
 * una lectura para operar, es la **recuperación** de un reintento. La unicidad la garantiza la base con un
 * índice único parcial (`WHERE "idempotencyKey" IS NOT NULL`); esta consulta es la que devuelve la fila que
 * ya existe.
 *
 * El puerto existe separado para que el caso de uso pueda rehacer la transacción y **después** buscar el
 * cobro: un `P2002` adentro de un `$transaction` aborta con `25P02` y la re-lectura no puede correr ahí
 * (`.agents/skills/money-change/SKILL.md` § CONCURRENCIA).
 */
export interface PaymentLookup {
  findPaymentByIdempotencyKey(key: string): Promise<PaymentRecord | null>;
}
