import { getMoneySettings } from "@/modules/money/features/get-money-settings/get-money-settings";
import { rateForCurrency, type MoneyContext } from "@/modules/money/domain/money-context";
import type { BusinessCurrencySettingsRepository } from "@/modules/money/ports/business-currency-settings-repository";
import type { CurrencyRepository } from "@/modules/money/ports/currency-repository";
import type { ExchangeRateRepository } from "@/modules/money/ports/exchange-rate-repository";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`, `A-85`) — **lo que un consumidor necesita para
 * cobrar hoy**: la moneda base vigente, con qué formato se muestra, qué monedas se aceptan y a qué tasa.
 *
 * Es una lectura de `money` y **no** un segundo dueño del dato: `getMoneySettings` sigue siendo el único
 * camino, y esta función sólo proyecta su resultado a la forma que el cobro congela (`MoneyContext`) más la
 * lista de monedas aceptadas, que es lo que el cliente necesita para ofrecer las opciones.
 *
 * Dos decisiones:
 *
 * 1. **Sólo entran las monedas activas y convertibles.** Una moneda apagada no se ofrece y no se convierte:
 *    `isActive` es la decisión del dueño, no una sugerencia.
 * 2. **La moneda base no lleva tasa.** Su equivalente es el monto mismo (`tasa 1`) y esa igualdad la escribe
 *    el snapshot del cobro (`D-020`), no un `1` puesto en la configuración.
 */
export type AcceptedCurrencies = {
  context: MoneyContext;
  /** Las monedas que el negocio acepta hoy, con lo que el cliente necesita para dibujarlas. */
  currencies: Array<{
    code: string;
    name: string;
    symbol: string;
    decimals: number;
    isBase: boolean;
  }>;
};

export type ListAcceptedCurrenciesDependencies = {
  currencyRepository: CurrencyRepository;
  exchangeRateRepository: ExchangeRateRepository;
  settingsRepository: BusinessCurrencySettingsRepository;
};

export async function listAcceptedCurrencies(
  dependencies: ListAcceptedCurrenciesDependencies,
): Promise<MoneyContext> {
  const { context } = await readAcceptedCurrencies(dependencies);

  return context;
}

/**
 * La misma lectura, con el catálogo que el cliente dibuja.
 *
 * Existe además de `listAcceptedCurrencies` porque el cobro necesita el **contexto** (para congelar) y la
 * pantalla necesita las **monedas** (para ofrecer): devolver las dos cosas de una sola lectura evita que las
 * dos puntas consulten por su cuenta y muestren opciones distintas.
 */
export async function readAcceptedCurrencies(
  dependencies: ListAcceptedCurrenciesDependencies,
): Promise<AcceptedCurrencies> {
  const settings = await getMoneySettings(dependencies);
  const active = settings.currencies.filter((currency) => currency.isActive);

  const rates: Record<string, number | null> = {};
  for (const currency of active) {
    const rate = rateForCurrency(currency.code, {
      baseCurrencyCode: settings.baseCurrencyCode,
      locale: settings.locale,
      rates: settings.activeRates,
    });

    if (rate !== null) rates[currency.code] = rate;
  }

  return {
    context: {
      baseCurrencyCode: settings.baseCurrencyCode,
      locale: settings.locale,
      rates,
      knownCurrencyCodes: active.map((currency) => currency.code),
    },
    currencies: active.map((currency) => ({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimals: currency.decimals,
      isBase: currency.code === settings.baseCurrencyCode,
    })),
  };
}
