import { InMemoryBusinessCurrencySettingsRepository } from "@/modules/money/adapters/in-memory-business-currency-settings-repository";
import { InMemoryCurrencyRepository } from "@/modules/money/adapters/in-memory-currency-repository";
import { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";
import type { ExchangeRateRecord } from "@/modules/money/domain/exchange-rate";
import type {
  BusinessCurrencySettingsRecord,
  CurrencyRecord,
} from "@/modules/money/domain/money.types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — los datos de prueba de la configuración financiera.
 *
 * Los tres dobles en memoria comparten el historial de tasas porque el cambio de moneda base escribe en
 * las dos tablas: armar cada test con su propia copia haría que la mitad de la operación quedara en un
 * objeto que nadie mira. Es el mismo criterio que `runInMemoryShiftTransaction`.
 */

export function currencyRecord(
  over: Partial<CurrencyRecord> & { code: string },
): CurrencyRecord {
  return {
    id: `cur_${over.code.toLowerCase()}`,
    name: over.code,
    symbol: over.code,
    decimals: 2,
    isKnown: true,
    isActive: true,
    sortOrder: 0,
    ...over,
  };
}

export function exchangeRateRecord(
  over: Partial<ExchangeRateRecord> & {
    fromCurrencyCode: string;
    toCurrencyCode: string;
    rate: number;
  },
): ExchangeRateRecord {
  return {
    id: `rate_${over.fromCurrencyCode}_${over.toCurrencyCode}_${over.effectiveFrom ?? "seed"}`,
    effectiveFrom: "2026-09-01T00:00:00.000Z",
    effectiveTo: null,
    ...over,
  };
}

export function moneyDependencies(input: {
  settings?: BusinessCurrencySettingsRecord | null;
  currencies?: CurrencyRecord[];
  rates?: ExchangeRateRecord[];
}) {
  const currencyRepository = new InMemoryCurrencyRepository({
    currencies: input.currencies ?? [],
  });
  const exchangeRateRepository = new InMemoryExchangeRateRepository({
    rates: input.rates ?? [],
  });
  const settingsRepository = new InMemoryBusinessCurrencySettingsRepository({
    settings: input.settings ?? null,
    exchangeRateRepository,
  });

  return { currencyRepository, exchangeRateRepository, settingsRepository };
}
