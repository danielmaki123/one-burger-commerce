import {
  convertToBaseCurrency,
  type ConversionResult,
} from "@/modules/money/domain/convert-to-base-currency";
import {
  getMoneySettings,
  type GetMoneySettingsDependencies,
} from "@/modules/money/features/get-money-settings/get-money-settings";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-68`, `A-69`, `D-019`) — **cuánto vale un monto en la moneda base**.
 *
 * Es el caso de uso que consulta un consumidor que no tiene la configuración a mano: resuelve la base
 * vigente, la tasa vigente de **esa** moneda y el catálogo, y delega la aritmética en
 * `convertToBaseCurrency` (`monto × tasa`, redondeado al centavo). No la reimplementa: la regla vive una
 * sola vez y este caso de uso sólo junta el dato.
 *
 * El resultado dice **por qué** no pudo: `unsupported-currency` («no conozco esa moneda», se arregla
 * agregándola al catálogo) es distinto de `missing-rate` («la conozco y no tiene tasa vigente», se
 * arregla registrando la tasa). Y nunca inventa un equivalente con una tasa que no corresponde.
 */
export type ConvertAmountDependencies = GetMoneySettingsDependencies;

export async function convertAmount(
  input: { amount: number; currency: string },
  dependencies: ConvertAmountDependencies,
): Promise<ConversionResult> {
  const settings = await getMoneySettings(dependencies);

  return convertToBaseCurrency(
    { amount: input.amount, currency: input.currency },
    {
      baseCurrencyCode: settings.baseCurrencyCode,
      rates: settings.activeRates,
      knownCurrencyCodes: settings.currencies.map((currency) => currency.code),
    },
  );
}
