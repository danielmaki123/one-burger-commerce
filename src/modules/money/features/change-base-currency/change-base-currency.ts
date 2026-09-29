import {
  LOCALE_PATTERN,
} from "@/modules/business-settings/domain/business-settings.types";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey, isSameCurrency } from "@/modules/money/domain/convert-to-base-currency";
import { baseCurrencyChangedAuditEntry } from "@/modules/money/domain/money-audit-entries";
import { MoneyError } from "@/modules/money/domain/money-errors";
import type { BusinessCurrencySettingsRepository } from "@/modules/money/ports/business-currency-settings-repository";
import type { CurrencyRepository } from "@/modules/money/ports/currency-repository";
import type { MoneyObligationGuard } from "@/modules/money/ports/money-obligation-guard";

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
  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`D-023`) — **la guarda de obligaciones vivas**.
   *
   * Opcional a propósito: es una **consulta a otro módulo** (pedidos y turnos) y hay llamadores que no la
   * tienen —los tests de esta operación, una instalación recién creada—. Sin guarda el caso de uso no
   * inventa obligaciones: se comporta como antes. En producción la composición **siempre** la inyecta.
   */
  obligationGuard?: MoneyObligationGuard;
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

  /**
   * `D-023` — **el cambio es de período cerrado**.
   *
   * Se consulta **antes** de escribir nada: si hay un turno con la caja abierta o pedidos que todavía deben
   * plata, sus montos quedarían expresados en la base vieja y el saldo exigido pasaría a significar otra cosa.
   * Rechazar después de cerrar los períodos de tasa dejaría la configuración a medio cambiar.
   */
  await assertNoOpenObligations(dependencies.obligationGuard);

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

/**
 * `D-023` — **¿se puede cambiar la base ahora?**
 *
 * El mensaje nombra la obligación concreta porque las dos se arreglan en lugares distintos: un turno se
 * cierra en Caja, y la deuda de un pedido se cobra en Órdenes. Decir sólo «hay obligaciones abiertas» deja al
 * dueño sin saber qué hacer.
 */
async function assertNoOpenObligations(guard?: MoneyObligationGuard): Promise<void> {
  if (!guard) return;

  const { openShifts, pendingObligations } = await guard.countOpenObligations();

  if (openShifts > 0) {
    throw new MoneyError(
      409,
      "CONFLICT",
      openShifts === 1
        ? "Hay una caja abierta: cerrala antes de cambiar la moneda base."
        : `Hay ${openShifts} cajas abiertas: cerralas antes de cambiar la moneda base.`,
      {
        code: "Cerrá la caja abierta antes de cambiar la moneda base.",
      },
    );
  }

  if (pendingObligations > 0) {
    throw new MoneyError(
      409,
      "CONFLICT",
      pendingObligations === 1
        ? "Hay 1 pedido con saldo pendiente: cobralo o cancelalo antes de cambiar la moneda base."
        : `Hay ${pendingObligations} pedidos con saldo pendiente: cobralos o cancelalos antes de cambiar la moneda base.`,
      {
        code: `${pendingObligations} pedido(s) con saldo pendiente quedarían expresados en la moneda base vieja.`,
      },
    );
  }
}
