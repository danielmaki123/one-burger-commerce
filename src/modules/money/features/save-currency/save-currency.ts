import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey, isSameCurrency } from "@/modules/money/domain/convert-to-base-currency";
import { assertCurrencyDraft, type CurrencyDraft } from "@/modules/money/domain/currency-catalog";
import { MoneyError } from "@/modules/money/domain/money-errors";
import type { CurrencyRecord } from "@/modules/money/domain/money.types";
import type { BusinessCurrencySettingsRepository } from "@/modules/money/ports/business-currency-settings-repository";
import type { CurrencyRepository } from "@/modules/money/ports/currency-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`, invariante 14) — **guardar una moneda del catálogo**.
 *
 * Tres reglas, y las tres son de dinero:
 *
 * 1. **Se valida con el dominio** (`assertCurrencyDraft`): una moneda conocida se completa del catálogo de
 *    fábrica y una personalizada exige su nombre y su símbolo. El error de un borrador inválido se traduce
 *    a `MoneyError` con el **campo** que lo causó, que es lo que el formulario necesita para señalarlo.
 * 2. **Un alta duplicada es un conflicto**, no un pisado silencioso: el código es la identidad de la
 *    moneda, y recargar la misma cambiaría en silencio con qué decimales se redondea
 *    (`mode: "update"` es la edición explícita, y sobre una moneda que no existe es un 404).
 * 3. **Nada se borra**: la baja es `setCurrencyActive(false)`, porque un cobro de ayer sigue nombrando su
 *    moneda. Y no se apaga la moneda base vigente ni la última activa: el negocio se quedaría sin moneda
 *    con la que cobrar.
 */
export type SaveCurrencyInput = {
  code: string;
  name?: string | null;
  symbol?: string | null;
  decimals?: number | null;
  /** Prender o apagar la moneda (la baja es `setCurrencyActive`, nunca un borrado). */
  isActive?: boolean;
  /**
   * `"create"` (por defecto) da de alta y **rechaza un código que ya existe**; `"update"` edita una
   * moneda del catálogo y falla con 404 si no está.
   */
  mode?: "create" | "update";
};

export type SaveCurrencyDependencies = {
  repository: CurrencyRepository;
  settingsRepository: BusinessCurrencySettingsRepository;
};

/**
 * Traduce el error del dominio (`"campo: mensaje"`) al error del caso de uso.
 *
 * `assertCurrencyDraft` tira un `Error` con el campo adelante porque el dominio no conoce HTTP; acá se
 * separa una sola vez para que la ruta pueda responder 422 con el detalle al lado del input.
 */
function resolveDraftOrThrow(input: SaveCurrencyInput): CurrencyDraft {
  try {
    return assertCurrencyDraft(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos validar la moneda.";
    const separator = message.indexOf(": ");
    const field = separator > 0 ? message.slice(0, separator) : "code";
    const text = separator > 0 ? message.slice(separator + 2) : message;

    throw new MoneyError(422, "VALIDATION_ERROR", text, { [field]: text });
  }
}

/** La base vigente sin depender de que la fila exista: sin fila, la del sistema. */
async function currentBaseCurrencyCode(
  settingsRepository: BusinessCurrencySettingsRepository,
): Promise<string> {
  const saved = await settingsRepository.getSettings();

  return currencyKey(saved?.baseCurrencyCode?.trim() || DEFAULT_BUSINESS_SETTINGS.currencyCode);
}

async function assertCanDeactivate(
  currency: CurrencyRecord,
  dependencies: SaveCurrencyDependencies,
): Promise<void> {
  if (isSameCurrency(await currentBaseCurrencyCode(dependencies.settingsRepository), currency.code)) {
    throw new MoneyError(
      409,
      "CONFLICT",
      `${currency.code} es la moneda base vigente y no se puede apagar.`,
      { isActive: "Cambiá la moneda base antes de apagarla." },
    );
  }

  if ((await dependencies.repository.countActiveCurrencies()) <= 1) {
    throw new MoneyError(409, "CONFLICT", "El catálogo no puede quedar sin ninguna moneda activa.", {
      isActive: "Dejá al menos una moneda activa.",
    });
  }
}

export async function saveCurrency(
  input: SaveCurrencyInput,
  dependencies: SaveCurrencyDependencies,
): Promise<{ data: CurrencyRecord }> {
  const { repository } = dependencies;
  const draft = resolveDraftOrThrow(input);
  const existing = await repository.findCurrencyByCode(draft.code);

  if (!existing && (input.mode ?? "create") === "update") {
    throw new MoneyError(404, "NOT_FOUND", `No encontramos la moneda ${draft.code}.`, {
      code: "Esa moneda no está en el catálogo.",
    });
  }

  if (existing && (input.mode ?? "create") === "create") {
    throw new MoneyError(409, "CONFLICT", `La moneda ${draft.code} ya está en el catálogo.`, {
      code: "Esa moneda ya está cargada.",
    });
  }

  if (existing?.isActive && input.isActive === false) {
    await assertCanDeactivate(existing, dependencies);
  }

  const saved = await repository.upsertCurrency(draft);

  // La baja (y la reactivación) es una operación aparte: el `upsert` no toca `isActive`.
  if (input.isActive !== undefined && input.isActive !== saved.isActive) {
    const updated = await repository.setCurrencyActive(saved.code, input.isActive);

    return { data: updated ?? saved };
  }

  return { data: saved };
}
