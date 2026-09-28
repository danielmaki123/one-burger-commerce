import {
  LOCALE_PATTERN,
} from "@/modules/business-settings/domain/business-settings.types";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey, isSameCurrency } from "@/modules/money/domain/convert-to-base-currency";
import { baseCurrencyChangedAuditEntry } from "@/modules/money/domain/money-audit-entries";
import { MoneyError } from "@/modules/money/domain/money-errors";
import type { BusinessCurrencySettingsRepository } from "@/modules/money/ports/business-currency-settings-repository";
import type { CurrencyRepository } from "@/modules/money/ports/currency-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-80`) — **cambiar la moneda base**.
 *
 * Es una **operación explícita y auditada**, no un campo de texto que reinterpreta hacia atrás lo
 * guardado (ley 7, `D-018`):
 *
 * 1. la moneda tiene que existir y estar **activa** —una base apagada dejaría al negocio sin moneda—, y la
 *    base que ya rige no se vuelve a "cambiar" (sería un no-op con asiento);
 * 2. **no recalcula nada**: este caso de uso ni siquiera recibe `Payment`, `Refund`, `Shift` ni `Invoice`.
 *    El hecho histórico conserva su moneda, su tasa y su equivalente, y por eso el `locale` —que es
 *    presentación— puede viajar en la misma operación sin tocar ningún monto;
 * 3. los períodos de tasa que apuntaban a la base anterior se **cierran** sin reescribir su tasa: siguen
 *    explicando el pasado y dejan de estar vigentes;
 * 4. queda el asiento con **de/para**, que es lo único que seis meses después explica por qué dos cobros
 *    de la misma semana tienen equivalentes en monedas distintas.
 */
export type ChangeBaseCurrencyDependencies = {
  currencyRepository: CurrencyRepository;
  settingsRepository: BusinessCurrencySettingsRepository;
  /** Quién cambia la base: firma el asiento. */
  actorUserId: string;
  /** El instante desde el que rige la base nueva. Inyectable para que el test fije la hora. */
  now?: () => Date;
};

export async function changeBaseCurrency(
  input: { code: string; locale?: string | null },
  dependencies: ChangeBaseCurrencyDependencies,
): Promise<{
  data: { baseCurrencyCode: string; locale: string; previousBaseCurrencyCode: string };
}> {
  const baseCurrencyCode = currencyKey(input.code ?? "");

  if (baseCurrencyCode.length < 2) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Elegí la moneda base.", {
      code: "Elegí la moneda base.",
    });
  }

  const currency = await dependencies.currencyRepository.findCurrencyByCode(baseCurrencyCode);

  if (!currency) {
    throw new MoneyError(404, "NOT_FOUND", `No encontramos la moneda ${baseCurrencyCode}.`, {
      code: "Esa moneda no está en el catálogo.",
    });
  }

  if (!currency.isActive) {
    throw new MoneyError(
      409,
      "CONFLICT",
      `La moneda ${baseCurrencyCode} está apagada: activala antes de usarla como base.`,
      { code: "Activá la moneda antes de elegirla como base." },
    );
  }

  const saved = await dependencies.settingsRepository.getSettings();
  const previousBaseCurrencyCode = currencyKey(
    saved?.baseCurrencyCode?.trim() || DEFAULT_BUSINESS_SETTINGS.currencyCode,
  );

  if (isSameCurrency(previousBaseCurrencyCode, baseCurrencyCode)) {
    throw new MoneyError(409, "CONFLICT", `${baseCurrencyCode} ya es la moneda base.`, {
      code: "Elegí otra moneda.",
    });
  }

  // El locale es presentación y no cambia ningún monto; se valida con la misma regla que Personalización.
  const locale = input.locale?.trim() || saved?.locale?.trim() || DEFAULT_BUSINESS_SETTINGS.locale;

  if (!LOCALE_PATTERN.test(locale)) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Usá el formato es-NI para el formato regional.", {
      locale: "Usá el formato es-NI.",
    });
  }

  const effectiveFrom = (dependencies.now ?? (() => new Date()))().toISOString();

  const updated = await dependencies.settingsRepository.changeBaseCurrency({
    baseCurrencyCode,
    locale,
    updatedByUserId: dependencies.actorUserId,
    previousBaseCurrencyCode,
    effectiveFrom,
    audit: baseCurrencyChangedAuditEntry({
      actorUserId: dependencies.actorUserId,
      previousBaseCurrencyCode,
      baseCurrencyCode,
      locale,
    }),
  });

  return {
    data: {
      baseCurrencyCode: updated.baseCurrencyCode,
      locale: updated.locale,
      previousBaseCurrencyCode,
    },
  };
}
