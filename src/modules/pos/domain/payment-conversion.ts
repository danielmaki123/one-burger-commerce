import {
  convertToBusinessCurrency,
  SUPPORTED_FOREIGN_CURRENCY,
} from "@/shared/lib/money-conversion";

import { PosError } from "./pos-errors";

/**
 * TASK-303a/305 — cuánto vale un cobro en la moneda del negocio.
 *
 * La aritmética vive en `src/shared/lib/money-conversion.ts` porque el arqueo usa la misma regla; acá
 * queda la traducción a error del POS, que es lo que la pantalla del mostrador muestra.
 *
 * El pedido y su total viven en la moneda del negocio; un cobro puede llegar en otra. La conversión
 * usa el **tipo de cambio configurado** en `/admin/settings` (decisión del owner: una casilla que se
 * ajusta cuando se mueve el mercado, no por venta ni por turno).
 */

export { SUPPORTED_FOREIGN_CURRENCY };

export function convertPaymentToBusinessCurrency(input: {
  amount: number;
  currency: string;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new PosError(422, "VALIDATION_ERROR", "El monto del cobro no puede ser negativo.", {
      amount: "El monto del cobro no puede ser negativo.",
    });
  }

  const converted = convertToBusinessCurrency(input);

  if (converted.ok) {
    return converted.amount;
  }

  if (converted.reason === "unsupported-currency") {
    throw new PosError(422, "VALIDATION_ERROR", `Todavía no se cobra en ${converted.currency}.`, {
      currency: `Todavía no se cobra en ${converted.currency}.`,
    });
  }

  throw new PosError(
    422,
    "VALIDATION_ERROR",
    "Cargá el tipo de cambio del dólar en Configuración para cobrar en dólares.",
    { usdExchangeRate: "Cargá el tipo de cambio del dólar en Configuración." },
  );
}
