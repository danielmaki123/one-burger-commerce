import {
  convertToBaseCurrency,
  type ConversionResult,
} from "@/modules/money/domain/convert-to-base-currency";
import type { MoneyContext } from "@/modules/money/domain/money-context";
import { roundCurrency } from "@/modules/money/domain/round-currency";

import { PosError } from "./pos-errors";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`, `A-85`) — cuánto vale un cobro **en la moneda
 * base vigente**.
 *
 * La aritmética es la de siempre (`monto × tasa`, redondeada al centavo) pero el dueño y el dato cambiaron:
 * antes leía la moneda del negocio y **el único** tipo de cambio configurado —el del dólar, un escalar en
 * `BusinessSettings`—; ahora recibe el **contexto de `money`**, que trae la base vigente y una tasa **por
 * moneda**. Con el escalar, cobrar en una moneda que no fuera el dólar era imposible aunque el negocio la
 * hubiera aceptado en Finanzas.
 *
 * Tres desenlaces posibles, y los tres se distinguen a propósito:
 *
 * 1. **convierte**: devuelve el equivalente en la base;
 * 2. **no conoce la moneda** (`unsupported-currency`): el mensaje manda a Finanzas a agregarla al catálogo;
 * 3. **la conoce y no tiene tasa vigente** (`missing-rate`): el mensaje manda a registrar la tasa.
 *
 * Antes los dos últimos decían «cargá el tipo de cambio del dólar», que con una moneda que no era el dólar
 * era una instrucción imposible de cumplir.
 */
export function convertPaymentToBusinessCurrency(input: {
  amount: number;
  currency: string;
  money: MoneyContext;
}): number {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new PosError(422, "VALIDATION_ERROR", "El monto del cobro no puede ser negativo.", {
      amount: "El monto del cobro no puede ser negativo.",
    });
  }

  const converted: ConversionResult = convertToBaseCurrency(
    { amount: input.amount, currency: input.currency },
    {
      baseCurrencyCode: input.money.baseCurrencyCode,
      rates: input.money.rates,
      ...(input.money.knownCurrencyCodes
        ? { knownCurrencyCodes: input.money.knownCurrencyCodes }
        : {}),
    },
  );

  if (converted.ok) {
    return converted.amount;
  }

  if (converted.reason === "unsupported-currency") {
    throw new PosError(422, "VALIDATION_ERROR", `Todavía no se cobra en ${converted.currency}.`, {
      currency: `Todavía no se cobra en ${converted.currency}. Agregala en Finanzas para poder cobrarla.`,
    });
  }

  throw new PosError(
    422,
    "VALIDATION_ERROR",
    `No hay una tasa vigente para ${converted.currency}: registrala en Finanzas antes de cobrar en esa moneda.`,
    { currency: `Registrá la tasa de ${converted.currency} en Finanzas.` },
  );
}

/**
 * La suma de los cobros **ya congelados**: el equivalente persistido de cada uno.
 *
 * `A-81`/`D-020` — un reintento no vuelve a convertir con la tasa vigente, así que la suma del reintento no
 * puede depender del contexto monetario de hoy. Un cobro legacy sin snapshot vale `0` acá: no se reinterpreta
 * (`D-020`), y quien necesite saber cuánto quedó sin explicar lee `unresolvedAmount` del estado financiero.
 */
export function recordedPaymentsBaseTotal(
  payments: readonly { baseAmount?: number | null }[],
): number {
  return roundCurrency(payments.reduce((sum, payment) => sum + (payment.baseAmount ?? 0), 0));
}
