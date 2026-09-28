import { describe, expect, it } from "vitest";

import { currencyRecord, exchangeRateRecord, moneyDependencies } from "@/shared/testing/money-fixtures";

import { convertAmount } from "./convert-amount";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-68`, `A-69`, `D-019`) — convertir un monto con la tasa vigente.
 *
 * La aritmética es la de `convertToBaseCurrency` (`monto × tasa`, redondeado al centavo): acá sólo se
 * resuelve **el dato** —la base de hoy, la tasa vigente de **esa** moneda y el catálogo— y se distingue
 * «no conozco esa moneda» (`unsupported-currency`, se arregla agregándola al catálogo) de «la conozco y
 * no tiene tasa» (`missing-rate`, se arregla registrando la tasa). Sin esa diferencia, el dueño no sabe
 * qué hacer con el error.
 */
describe("convertAmount", () => {
  it("un monto en la moneda base queda igual, redondeado al centavo", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
      currencies: [currencyRecord({ code: "NIO" })],
    });

    await expect(
      convertAmount({ amount: 130.005, currency: "NIO" }, dependencies),
    ).resolves.toEqual({ ok: true, amount: 130.01 });
  });

  it("convierte con la tasa vigente de esa moneda, sin importar mayúsculas ni espacios", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
      rates: [exchangeRateRecord({ fromCurrencyCode: "USD", toCurrencyCode: "NIO", rate: 36.5 })],
    });

    await expect(
      convertAmount({ amount: 10, currency: " usd " }, dependencies),
    ).resolves.toEqual({ ok: true, amount: 365 });
  });

  it("no inventa un equivalente cuando falta la tasa: lo declara", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
    });

    await expect(convertAmount({ amount: 10, currency: "USD" }, dependencies)).resolves.toEqual({
      ok: false,
      reason: "missing-rate",
      currency: "USD",
    });
  });

  it("una moneda que no está en el catálogo es `unsupported-currency`, no `missing-rate`", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
      rates: [exchangeRateRecord({ fromCurrencyCode: "USD", toCurrencyCode: "NIO", rate: 36.5 })],
    });

    await expect(convertAmount({ amount: 10, currency: "EUR" }, dependencies)).resolves.toEqual({
      ok: false,
      reason: "unsupported-currency",
      currency: "EUR",
    });
  });

  it("usa la tasa vigente y no la cerrada", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
      rates: [
        exchangeRateRecord({
          fromCurrencyCode: "USD",
          toCurrencyCode: "NIO",
          rate: 36.5,
          effectiveTo: "2026-09-20T00:00:00.000Z",
        }),
        exchangeRateRecord({
          fromCurrencyCode: "USD",
          toCurrencyCode: "NIO",
          rate: 37,
          effectiveFrom: "2026-09-20T00:00:00.000Z",
        }),
      ],
    });

    await expect(convertAmount({ amount: 10, currency: "USD" }, dependencies)).resolves.toEqual({
      ok: true,
      amount: 370,
    });
  });

  it("una tasa registrada contra otra base no sirve para convertir contra la de hoy", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "USD", locale: "en-US", updatedByUserId: null },
      currencies: [currencyRecord({ code: "USD" }), currencyRecord({ code: "EUR" })],
      rates: [exchangeRateRecord({ fromCurrencyCode: "EUR", toCurrencyCode: "NIO", rate: 39.42 })],
    });

    await expect(convertAmount({ amount: 10, currency: "EUR" }, dependencies)).resolves.toEqual({
      ok: false,
      reason: "missing-rate",
      currency: "EUR",
    });
  });
});
