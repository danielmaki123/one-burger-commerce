import { convertAmountToBase, isSameCurrency } from "@/modules/money/domain/convert-to-base-currency";
import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69c`, invariante 3) — **la suma de un cobro partido, en la moneda
 * del negocio**.
 *
 * El mostrador del POS mostraba «Cobrado» sumando `amount` de cada fila **crudo** y formateándolo con el
 * símbolo de la moneda del negocio: con `10 USD + 355 NIO` a tasa 36.5 decía **C$365** sobre un pedido de
 * C$720. El cajero veía cubierto un pedido que no lo estaba, y el servidor —que **sí** convierte antes de
 * comparar (`pos-sale.ts`) y que ahora además congela el snapshot— rechazaba el cobro con un error que la
 * pantalla no explicaba.
 *
 * La regla es **una sola** y es la misma del resto del sistema: `monto × tasa`, redondeado con
 * `roundCurrency`. Vive en `money` y no en el componente por la misma razón que la conversión: una regla de
 * dinero no se escribe dos veces.
 *
 * Una fila cuya moneda no es la base y no tiene tasa **no se suma** (no se cuenta como si valiera uno): el
 * sistema dice «no se sabe», no inventa un equivalente (ley 7, `D-020`). Hoy el POS sólo ofrece la moneda
 * del negocio y el dólar, así que ese caso no se alcanza desde la pantalla; la regla existe para que un dato
 * raro no se convierta en un número falso.
 */
export type PaidRow = {
  /** El monto tal como lo tiene la pantalla: el POS guarda sus borradores como **texto**. */
  amount: number | string;
  /**
   * Moneda en la que se cargó **esta** fila. `null` **o vacío** = la moneda del negocio: el POS guarda sus
   * borradores con `""` hasta que el cajero elige, y las dos formas significan lo mismo.
   */
  currency: string | null;
};

export function paidTotalInBaseCurrency(input: {
  payments: readonly PaidRow[];
  baseCurrencyCode: string;
  /** Cuántas unidades de la moneda del negocio vale un dólar. `null` = sin tasa cargada. */
  usdExchangeRate: number | null;
}): number {
  const baseCurrencyCode = input.baseCurrencyCode.trim().toUpperCase();
  let total = 0;

  for (const payment of input.payments) {
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount)) continue;

    const currency = payment.currency?.trim() || baseCurrencyCode;

    if (isSameCurrency(currency, baseCurrencyCode)) {
      total += amount;
      continue;
    }

    const converted = convertAmountToBase({
      amount,
      currency,
      baseCurrencyCode,
      rates: { USD: input.usdExchangeRate },
    });

    if (converted === null) continue;

    total += converted;
  }

  return roundCurrency(total);
}
