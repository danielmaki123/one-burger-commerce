import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { LOCALE_PATTERN } from "@/modules/business-settings/domain/business-settings.types";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { MoneyError } from "@/modules/money/domain/money-errors";
import type { BusinessCurrencySettingsRepository } from "@/modules/money/ports/business-currency-settings-repository";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-87`, `D-018`) — **cambiar el formato regional**.
 *
 * El formato es **presentación**: cambia cómo se ve la plata, no su valor. Por eso es una operación propia y
 * no un caso particular de `changeBaseCurrency`:
 *
 * 1. **no** cierra ningún período de tasa —no hay base nueva contra la que registrar nada—;
 * 2. **no** deja asiento de cambio de base: no hay de/para porque no cambió la moneda;
 * 3. guarda el locale solo, sin fingir una operación que el dominio prohíbe repetir.
 *
 * El bug que esto cierra: el modal «Cambiar formato» de Finanzas llamaba a `changeBaseCurrency` con la base
 * **ya vigente**, y ese caso de uso lo rechaza con `409` («ya es la moneda base»). El formato no se podía
 * guardar por ningún camino.
 */
export type UpdateMoneyLocaleDependencies = {
  settingsRepository: BusinessCurrencySettingsRepository;
  /** Quién cambió el formato. Queda en la fila única, igual que en el cambio de base. */
  actorUserId?: string | null;
};

export async function updateMoneyLocale(
  input: { locale: string },
  dependencies: UpdateMoneyLocaleDependencies,
): Promise<{ data: { baseCurrencyCode: string; locale: string } }> {
  const locale = input.locale?.trim() ?? "";

  if (!LOCALE_PATTERN.test(locale)) {
    throw new MoneyError(422, "VALIDATION_ERROR", "Usá el formato es-NI para el formato regional.", {
      locale: "Usá el formato es-NI.",
    });
  }

  const saved = await dependencies.settingsRepository.getSettings();

  const updated = await dependencies.settingsRepository.setLocale({
    locale,
    updatedByUserId: dependencies.actorUserId ?? null,
  });

  /**
   * La moneda base **no cambia**: se devuelve la vigente para que la pantalla dibuje el mismo estado. Si no
   * hay fila guardada, la base es la del sistema (`DEFAULT_BUSINESS_SETTINGS`), igual que en el cambio de base.
   */
  return {
    data: {
      baseCurrencyCode: currencyKey(
        saved?.baseCurrencyCode?.trim() || updated.baseCurrencyCode || DEFAULT_BUSINESS_SETTINGS.currencyCode,
      ),
      locale: updated.locale,
    },
  };
}
