import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { KNOWN_CURRENCIES, resolveCurrencyDraft } from "@/modules/money/domain/currency-catalog";
import { ratesFromActive } from "@/modules/money/domain/exchange-rate";
import type { MoneySettingsView } from "@/modules/money/domain/money.types";
import type { BusinessCurrencySettingsRepository } from "@/modules/money/ports/business-currency-settings-repository";
import type { CurrencyRepository } from "@/modules/money/ports/currency-repository";
import type { ExchangeRateRepository } from "@/modules/money/ports/exchange-rate-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-69`, `A-80`) — **la configuración financiera vigente**.
 *
 * Es lo que lee la pantalla de Finanzas (y cualquier consumidor que necesite convertir): qué moneda base
 * rige, con qué formato regional, qué monedas conoce el negocio, a qué tasa se cambia cada una **hoy** y
 * cuál es el catálogo de fábrica que completa el formulario.
 *
 * Dos decisiones que no son obvias:
 *
 * 1. **Sin fila de configuración se cae a los defaults del negocio**, no a un error: hoy la moneda base es
 *    un campo de `BusinessSettings` y la fila nueva puede no existir todavía. Y en ese caso la moneda base
 *    se **materializa** en el catálogo: sin su fila no hay símbolo, ni decimales, ni forma de registrarla
 *    como base —el sistema tiene que arrancar sin una migración de datos—. Es idempotente: existe una sola
 *    vez.
 * 2. **`activeRates` es la tasa vigente, no el historial**: el mapa que alimenta `convertToBaseCurrency`
 *    sale de `ratesFromActive`, que ignora los períodos cerrados y las tasas registradas contra otra base.
 *    Lo que no está vigente explica el pasado; no convierte el presente.
 */
export type GetMoneySettingsDependencies = {
  currencyRepository: CurrencyRepository;
  exchangeRateRepository: ExchangeRateRepository;
  settingsRepository: BusinessCurrencySettingsRepository;
};

/**
 * Se asegura de que la moneda base exista en el catálogo.
 *
 * `resolveCurrencyDraft` es la puerta del dominio: completa una moneda conocida con su nombre, su símbolo
 * y sus decimales, y acepta una personalizada. Si el código guardado no es válido (vacío o demasiado
 * corto), no se inventa una moneda: la lectura sigue y el catálogo queda como está.
 */
async function ensureBaseCurrency(
  repository: CurrencyRepository,
  baseCurrencyCode: string,
): Promise<void> {
  if (await repository.findCurrencyByCode(baseCurrencyCode)) return;

  const draft =
    resolveCurrencyDraft({ code: baseCurrencyCode }) ??
    resolveCurrencyDraft({ code: baseCurrencyCode, name: baseCurrencyCode, symbol: baseCurrencyCode });

  if (!draft) return;

  await repository.upsertCurrency(draft);
}

export async function getMoneySettings(
  dependencies: GetMoneySettingsDependencies,
): Promise<MoneySettingsView> {
  const saved = await dependencies.settingsRepository.getSettings();

  const baseCurrencyCode = currencyKey(
    saved?.baseCurrencyCode?.trim() || DEFAULT_BUSINESS_SETTINGS.currencyCode,
  );
  const locale = saved?.locale?.trim() || DEFAULT_BUSINESS_SETTINGS.locale;

  await ensureBaseCurrency(dependencies.currencyRepository, baseCurrencyCode);

  const [currencies, activeRateRows] = await Promise.all([
    dependencies.currencyRepository.listCurrencies(),
    dependencies.exchangeRateRepository.listActiveRatesTo(baseCurrencyCode),
  ]);

  return {
    baseCurrencyCode,
    locale,
    currencies,
    activeRates: ratesFromActive(activeRateRows, baseCurrencyCode),
    knownCurrencies: KNOWN_CURRENCIES,
  };
}
