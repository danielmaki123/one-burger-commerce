import type { RecordAuditLogInput } from "@/modules/audit/ports/audit-log-repository";
import type { ExchangeRateRecord } from "@/modules/money/domain/exchange-rate";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-72`, `A-80`, `D-018`) — el puerto del historial de tasas.
 *
 * La tasa es un **hecho con fecha**: registrar una nueva **cierra** la vigente y agrega una fila, nunca la
 * pisa. `createRate` hace las dos cosas —y escribe el asiento de auditoría— en **una sola unidad**: es el
 * límite atómico de la operación (`money-change` § *TRANSACCIÓN*), y por eso el asiento viaja como dato
 * en la llamada en vez de escribirse por un `AuditLogRepository` aparte, que usaría el cliente raíz y
 * quedaría fuera de la transacción.
 */
export type CreateExchangeRateInput = {
  fromCurrencyCode: string;
  /** La moneda base vigente: la tasa se registra **contra** ella y así queda el hecho explicado. */
  toCurrencyCode: string;
  rate: number;
  /** ISO desde el que rige (inclusive). El período anterior se cierra exactamente acá. */
  effectiveFrom: string;
  createdByUserId: string | null;
  /** El asiento de `AdminAuditLog` que se escribe en la misma unidad que la fila (`A-80`). */
  audit: RecordAuditLogInput;
};

export interface ExchangeRateRepository {
  /** Todo el historial de un par, del más viejo al más nuevo. */
  listRatesForPair(from: string, to: string): Promise<ExchangeRateRecord[]>;
  /** Las tasas **vigentes** (`effectiveTo` nulo) que apuntan a esa moneda base. */
  listActiveRatesTo(baseCurrencyCode: string): Promise<ExchangeRateRecord[]>;
  /**
   * Cierra el período vigente del par y crea la fila nueva **en una sola unidad**, con el asiento de
   * auditoría adentro. Devuelve la fila creada.
   */
  createRate(input: CreateExchangeRateInput): Promise<ExchangeRateRecord>;
  /** Cierra el período vigente de un par sin crear nada. Devuelve cuántas filas cerró. */
  closeActiveRate(from: string, to: string, effectiveTo: string): Promise<number>;
  /**
   * Cierra **todos** los períodos abiertos que apuntan a esa moneda base, sin reescribir la tasa.
   *
   * Es lo que hace un cambio de moneda base (`D-018`): las tasas viejas siguen nombrando la base contra
   * la que se registraron, pero dejan de estar vigentes.
   */
  closeRatesTo(baseCurrencyCode: string, effectiveTo: string): Promise<number>;
}
