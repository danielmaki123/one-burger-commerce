import { InMemoryAuditLogRepository } from "@/modules/audit/adapters/in-memory-audit-log-repository";
import type { AuditLogRepository } from "@/modules/audit/ports/audit-log-repository";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import type { BusinessCurrencySettingsRecord } from "@/modules/money/domain/money.types";
import type {
  BusinessCurrencySettingsRepository,
  ChangeBaseCurrencyRepositoryInput,
} from "@/modules/money/ports/business-currency-settings-repository";
import type { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el doble en memoria de la autoridad monetaria.
 *
 * Necesita el historial de tasas **a propósito**: el cambio de moneda base cierra los períodos abiertos
 * contra la base anterior, y eso es una escritura sobre otra tabla. Reproducir esa mitad con estado
 * propio haría que el doble y la base mintieran distinto —y que el test del cambio de base no probara
 * nada—; se le pasa el mismo doble de tasas que usa el test, como
 * `runInMemoryShiftTransaction({ shiftRepository, paymentRepository })`.
 *
 * La fila y el asiento son todo o nada: si el asiento falla, la fila vuelve a como estaba.
 */
export class InMemoryBusinessCurrencySettingsRepository
  implements BusinessCurrencySettingsRepository
{
  private settings: BusinessCurrencySettingsRecord | null;

  /** El sink del asiento. Un test puede pasarlo y leer lo que se firmó. */
  readonly auditLog: AuditLogRepository;

  /**
   * El historial de tasas, **completo** y no sólo `closeRatesTo`: el cambio de base lo cierra y, si el
   * asiento falla, hay que **volver a abrirlo**. Un número de filas cerradas no alcanza para deshacer el
   * cierre, así que el doble necesita poder sacar una foto y restaurarla —lo que en Postgres hace la
   * transacción—.
   */
  private readonly exchangeRateRepository: InMemoryExchangeRateRepository;

  constructor(seed: {
    settings?: BusinessCurrencySettingsRecord | null;
    exchangeRateRepository: InMemoryExchangeRateRepository;
    auditLog?: AuditLogRepository;
  }) {
    this.settings = seed.settings ? { ...seed.settings } : null;
    this.exchangeRateRepository = seed.exchangeRateRepository;
    this.auditLog = seed.auditLog ?? new InMemoryAuditLogRepository();
  }

  async getSettings(): Promise<BusinessCurrencySettingsRecord | null> {
    return this.settings ? { ...this.settings } : null;
  }

  async changeBaseCurrency(
    input: ChangeBaseCurrencyRepositoryInput,
  ): Promise<BusinessCurrencySettingsRecord> {
    const baseCurrencyCode = currencyKey(input.baseCurrencyCode);
    const previousBaseCurrencyCode = currencyKey(input.previousBaseCurrencyCode);
    const snapshot = this.settings ? { ...this.settings } : null;
    const ratesSnapshot = this.exchangeRateRepository.snapshot();

    try {
      if (previousBaseCurrencyCode !== baseCurrencyCode) {
        await this.exchangeRateRepository.closeRatesTo(
          previousBaseCurrencyCode,
          input.effectiveFrom,
        );
      }

      this.settings = {
        baseCurrencyCode,
        locale: input.locale,
        updatedByUserId: input.updatedByUserId,
      };

      await this.auditLog.record(input.audit);

      return { ...this.settings };
    } catch (error) {
      /**
       * Todo o nada: se revierte **también el cierre de las tasas**. Dejar la base vieja con sus tasas ya
       * cerradas es un estado que la base real no puede tener (ahí lo impide la transacción) y que haría
       * que el doble mintiera justo en el caso que el test tiene que atrapar.
       */
      this.settings = snapshot;
      this.exchangeRateRepository.restore(ratesSnapshot);
      throw error;
    }
  }
}
