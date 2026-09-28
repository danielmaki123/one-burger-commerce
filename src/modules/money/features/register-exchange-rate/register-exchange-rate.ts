import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey, isSameCurrency } from "@/modules/money/domain/convert-to-base-currency";
import { assertRateValue, type ExchangeRateRecord } from "@/modules/money/domain/exchange-rate";
import { rateRegisteredAuditEntry } from "@/modules/money/domain/money-audit-entries";
import { MoneyError } from "@/modules/money/domain/money-errors";
import type { BusinessCurrencySettingsRepository } from "@/modules/money/ports/business-currency-settings-repository";
import type { ExchangeRateRepository } from "@/modules/money/ports/exchange-rate-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-72`, `A-80`, `D-018`) — **registrar una tasa**.
 *
 * Registrar una tasa es un **hecho nuevo**, no una edición: el período vigente se cierra en el instante
 * del registro (semiabierto, así dos períodos no se solapan) y arranca una fila nueva. Es lo que hace que
 * un cobro de ayer se pueda explicar con la tasa que tenía ayer y no con la de hoy (`D-020`).
 *
 * Dos cosas que no son obvias:
 *
 * 1. **El destino es siempre la moneda base vigente**: una tasa se registra *contra* la base, y por eso
 *    queda escrito en la fila contra cuál se registró. Cuando la base cambie, esa tasa seguirá explicando
 *    lo que explicaba.
 * 2. **La fila y su asiento son una unidad**: el caso de uso arma el asiento y el repositorio lo escribe
 *    con el mismo cliente de la transacción que cierra el período y crea la fila (`A-80`). Si el asiento
 *    falla, la tasa no queda registrada.
 */
export type RegisterExchangeRateDependencies = {
  repository: ExchangeRateRepository;
  settingsRepository: BusinessCurrencySettingsRepository;
  /** Quién registra la tasa: firma el asiento. */
  actorUserId: string;
  /** El instante del registro. Inyectable para que el test fije la hora. */
  now?: () => Date;
};

/** La base vigente sin depender de que la fila exista: sin fila, la del sistema. */
async function currentBaseCurrencyCode(
  settingsRepository: BusinessCurrencySettingsRepository,
): Promise<string> {
  const saved = await settingsRepository.getSettings();

  return currencyKey(saved?.baseCurrencyCode?.trim() || DEFAULT_BUSINESS_SETTINGS.currencyCode);
}

/** Traduce el rechazo del dominio (`assertRateValue`) al error con el campo que lo causó. */
function resolveRateOrThrow(rate: unknown): number {
  try {
    return assertRateValue(Number(rate));
  } catch (error) {
    const message = error instanceof Error ? error.message : "La tasa no es un número válido.";

    throw new MoneyError(422, "VALIDATION_ERROR", message, { rate: message });
  }
}

export async function registerExchangeRate(
  input: { fromCurrencyCode: string; rate: number },
  dependencies: RegisterExchangeRateDependencies,
): Promise<{ data: ExchangeRateRecord }> {
  const fromCurrencyCode = currencyKey(input.fromCurrencyCode ?? "");

  if (fromCurrencyCode.length < 2) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Elegí la moneda de la tasa.", {
      fromCurrencyCode: "Elegí la moneda.",
    });
  }

  const rate = resolveRateOrThrow(input.rate);
  const toCurrencyCode = await currentBaseCurrencyCode(dependencies.settingsRepository);

  if (isSameCurrency(fromCurrencyCode, toCurrencyCode)) {
    throw new MoneyError(
      422,
      "VALIDATION_ERROR",
      `La tasa se registra entre dos monedas distintas: ${toCurrencyCode} es la moneda base.`,
      { fromCurrencyCode: "Elegí otra moneda." },
    );
  }

  const effectiveFrom = (dependencies.now ?? (() => new Date()))().toISOString();

  const created = await dependencies.repository.createRate({
    fromCurrencyCode,
    toCurrencyCode,
    rate,
    effectiveFrom,
    createdByUserId: dependencies.actorUserId,
    audit: rateRegisteredAuditEntry({
      actorUserId: dependencies.actorUserId,
      fromCurrencyCode,
      toCurrencyCode,
      rate,
      effectiveFrom,
    }),
  });

  return { data: created };
}
