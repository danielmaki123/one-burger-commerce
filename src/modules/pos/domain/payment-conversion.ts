import { roundCurrency } from "@/shared/lib/order-totals";

import { PosError } from "./pos-errors";

/**
 * TASK-303a — cuánto vale un cobro en la moneda del negocio.
 *
 * El pedido y su total viven en la moneda del negocio; un cobro puede llegar en otra. La conversión
 * usa el **tipo de cambio configurado** en `/admin/settings` (decisión del owner: una casilla que se
 * ajusta cuando se mueve el mercado, no por venta ni por turno).
 *
 * Sin tasa cargada, un cobro en otra moneda **se rechaza con el motivo**: convertir con un número
 * inventado sería cobrar mal sin que nadie lo note.
 */

/** La única moneda extranjera que el negocio toma hoy. Agregar otra es agregar su tasa y su fila. */
export const SUPPORTED_FOREIGN_CURRENCY = "USD";

export function convertPaymentToBusinessCurrency(input: {
  amount: number;
  currency: string;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  const currency = input.currency.trim().toUpperCase();
  const businessCurrency = input.businessCurrencyCode.trim().toUpperCase();

  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new PosError(422, "VALIDATION_ERROR", "El monto del cobro no puede ser negativo.", {
      amount: "El monto del cobro no puede ser negativo.",
    });
  }

  if (currency === businessCurrency) {
    return roundCurrency(input.amount);
  }

  if (currency !== SUPPORTED_FOREIGN_CURRENCY) {
    throw new PosError(422, "VALIDATION_ERROR", `Todavía no se cobra en ${currency}.`, {
      currency: `Todavía no se cobra en ${currency}.`,
    });
  }

  const rate = input.usdExchangeRate;
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    throw new PosError(
      422,
      "VALIDATION_ERROR",
      "Cargá el tipo de cambio del dólar en Configuración para cobrar en dólares.",
      { usdExchangeRate: "Cargá el tipo de cambio del dólar en Configuración." },
    );
  }

  return roundCurrency(input.amount * rate);
}
