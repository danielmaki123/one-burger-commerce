import { describe, expect, it } from "vitest";

import {
  convertAmountToBase,
  convertToBaseCurrency,
} from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-68`, `A-69`, `D-016`) — **la única conversión de dinero**.
 *
 * La aritmética es la que ya existía en `shared/lib/money-conversion.ts` (`TASK-305`): no se reescribe, se
 * le cambia el **dueño** y se le saca el literal que asumía que la única moneda extranjera es el dólar
 * (`SUPPORTED_FOREIGN_CURRENCY = "USD"`). Ahora la tasa llega como **dato** —una tasa por moneda, resuelta
 * por `money` con la vigencia correspondiente— y no como un escalar del dólar.
 *
 * Los `expected` salen de la regla del negocio: `monto × tasa`, redondeado al centavo.
 */
describe("convertToBaseCurrency", () => {
  it("devuelve el mismo monto cuando la moneda es la base", () => {
    const result = convertToBaseCurrency(
      { amount: 365, currency: "NIO" },
      { baseCurrencyCode: "NIO", rates: {} },
    );

    expect(result).toEqual({ ok: true, amount: 365 });
  });

  it("convierte una moneda extranjera con la tasa del par", () => {
    const result = convertToBaseCurrency(
      { amount: 10, currency: "USD" },
      { baseCurrencyCode: "NIO", rates: { USD: 36.5 } },
    );

    // 10 × 36.5 = 365 — el número exacto que el cobro de un pedido de C$365 tiene que reconocer.
    expect(result).toEqual({ ok: true, amount: 365 });
  });

  it("normaliza la moneda: minúsculas y espacios no cambian el resultado", () => {
    const result = convertToBaseCurrency(
      { amount: 10, currency: " usd " },
      { baseCurrencyCode: " nio ", rates: { USD: 36.5 } },
    );

    expect(result).toEqual({ ok: true, amount: 365 });
  });

  it("convierte una moneda que NO es el dólar (el literal murió, D-019)", () => {
    const result = convertToBaseCurrency(
      { amount: 100, currency: "EUR" },
      { baseCurrencyCode: "NIO", rates: { EUR: 39.42 } },
    );

    expect(result).toEqual({ ok: true, amount: 3942 });
  });

  it("redondea el resultado al centavo", () => {
    const result = convertToBaseCurrency(
      { amount: 3, currency: "USD" },
      { baseCurrencyCode: "NIO", rates: { USD: 36.355 } },
    );

    expect(result).toEqual({ ok: true, amount: 109.07 });
  });

  it("falla con `missing-rate` cuando la moneda existe pero no tiene tasa vigente", () => {
    const result = convertToBaseCurrency(
      { amount: 10, currency: "USD" },
      { baseCurrencyCode: "NIO", rates: {} },
    );

    expect(result).toEqual({ ok: false, reason: "missing-rate", currency: "USD" });
  });

  it("falla con `unsupported-currency` cuando la moneda no está en el catálogo", () => {
    // La diferencia es la del negocio: «no hay tasa cargada» se arregla registrando la tasa; «no conozco
    // esa moneda» se arregla agregándola al catálogo. Un solo mensaje para las dos cosas deja al dueño sin
    // saber qué hacer.
    const result = convertToBaseCurrency(
      { amount: 10, currency: "XXX" },
      { baseCurrencyCode: "NIO", rates: { USD: 36.5 }, knownCurrencyCodes: ["NIO", "USD"] },
    );

    expect(result).toEqual({ ok: false, reason: "unsupported-currency", currency: "XXX" });
  });

  it("una tasa nula, cero o negativa es `missing-rate`, no un equivalente inventado", () => {
    for (const rate of [null, 0, -1, Number.NaN]) {
      const result = convertToBaseCurrency(
        { amount: 10, currency: "USD" },
        { baseCurrencyCode: "NIO", rates: { USD: rate as number } },
      );

      expect(result).toEqual({ ok: false, reason: "missing-rate", currency: "USD" });
    }
  });
});

/**
 * `A-68` — la variante booleana para el camino del redondeo: convierte **y** redondea con el mismo
 * algoritmo, que es lo que impide que dos superficies redondeen distinto el mismo cobro.
 */
describe("convertAmountToBase", () => {
  it("es la puerta que usa una superficie que ya sabe que la tasa existe", () => {
    expect(
      convertAmountToBase({ amount: 10, currency: "USD", baseCurrencyCode: "NIO", rates: { USD: 36.5 } }),
    ).toBe(365);
  });

  it("devuelve `null` en vez de un número cuando no puede convertir", () => {
    expect(
      convertAmountToBase({ amount: 10, currency: "USD", baseCurrencyCode: "NIO", rates: {} }),
    ).toBeNull();
  });
});
