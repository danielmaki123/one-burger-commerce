import type { RecordAuditLogInput } from "@/modules/audit/ports/audit-log-repository";
import type { BusinessCurrencySettingsRecord } from "@/modules/money/domain/money.types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-80`) — el puerto de **la autoridad monetaria actual**.
 *
 * Cuál es la moneda base vive en una **fila única**, y cambiarla no es escribir un campo: es un hecho con
 * momento de vigencia que además **cierra** los períodos de tasa registrados contra la base anterior
 * (sin reescribirlos) y deja su asiento. Las tres escrituras van juntas: `changeBaseCurrency` es el
 * límite atómico de esa operación, y por eso el puerto lo expone como una sola llamada y no como tres
 * que cada caso de uso tenga que ordenar.
 */
export type ChangeBaseCurrencyRepositoryInput = {
  baseCurrencyCode: string;
  locale: string;
  updatedByUserId: string | null;
  /**
   * La base que dejaba de regir: sus períodos de tasa abiertos se cierran en la misma unidad. Nunca es
   * `null` —sin fila guardada la base vigente es la del sistema—, así que un cambio siempre sabe de qué
   * moneda viene.
   */
  previousBaseCurrencyCode: string;
  /** ISO del momento desde el que rige la base nueva: cierra los períodos anteriores exactamente ahí. */
  effectiveFrom: string;
  /** El asiento de `AdminAuditLog` (de qué moneda a cuál) que se escribe en la misma unidad. */
  audit: RecordAuditLogInput;
};

export interface BusinessCurrencySettingsRepository {
  /** La fila única, o `null` cuando la base todavía no se migró (el caso de uso cae a los defaults). */
  getSettings(): Promise<BusinessCurrencySettingsRecord | null>;
  /**
   * Cambia la moneda base en **una sola unidad**: la fila, el cierre de los períodos de la base anterior
   * y el asiento. **No** recalcula ningún hecho histórico (`D-018`).
   */
  changeBaseCurrency(
    input: ChangeBaseCurrencyRepositoryInput,
  ): Promise<BusinessCurrencySettingsRecord>;
}
