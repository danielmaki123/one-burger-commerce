import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyRecord, exchangeRateRecord, moneyDependencies } from "@/shared/testing/money-fixtures";

import { getMoneySettings } from "./get-money-settings";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-80`) — la lectura de la configuración financiera.
 *
 * Dos reglas que la pantalla necesita y que hoy no existen:
 *
 * 1. **La base no se inventa**: sale de la fila única y, si esa fila no está (una base sin migrar), cae a
 *    los defaults del negocio. Para que el sistema arranque sin una migración de datos, la moneda base se
 *    **materializa** en el catálogo si falta: sin ella no hay símbolo, ni decimales, ni forma de
 *    registrarla como base.
 * 2. **La tasa que se muestra es la vigente**: el historial sirve para explicar el pasado, no para
 *    convertir hoy. Una tasa cerrada no entra en el mapa.
 */
describe("getMoneySettings", () => {
  it("sin la fila de configuración cae a los defaults del negocio y materializa la moneda base", async () => {
    const dependencies = moneyDependencies({
      rates: [
        exchangeRateRecord({ fromCurrencyCode: "USD", toCurrencyCode: "NIO", rate: 36.5 }),
      ],
    });

    const settings = await getMoneySettings(dependencies);

    expect(settings.baseCurrencyCode).toBe(DEFAULT_BUSINESS_SETTINGS.currencyCode);
    expect(settings.locale).toBe(DEFAULT_BUSINESS_SETTINGS.locale);
    expect(settings.currencies.map((currency) => currency.code)).toEqual(["NIO"]);
    expect(settings.currencies[0]).toMatchObject({
      name: "Córdoba nicaragüense",
      symbol: "C$",
      decimals: 2,
      isActive: true,
    });
    // La tasa vigente del dólar contra la base: el mapa que consume la conversión.
    expect(settings.activeRates).toEqual({ USD: 36.5 });
  });

  it("materializar la base es idempotente: dos lecturas no dejan dos filas", async () => {
    const dependencies = moneyDependencies({});

    await getMoneySettings(dependencies);
    await getMoneySettings(dependencies);

    const currencies = await dependencies.currencyRepository.listCurrencies();

    expect(currencies.map((currency) => currency.code)).toEqual(["NIO"]);
  });

  it("con la fila propia usa su moneda base, su locale y sólo las tasas vigentes contra esa base", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "USD", locale: "en-US", updatedByUserId: "user_owner" },
      currencies: [
        currencyRecord({ code: "USD", sortOrder: 0 }),
        currencyRecord({ code: "NIO", sortOrder: 1 }),
        currencyRecord({ code: "EUR", sortOrder: 2 }),
      ],
      rates: [
        exchangeRateRecord({ fromCurrencyCode: "NIO", toCurrencyCode: "USD", rate: 0.027 }),
        exchangeRateRecord({ fromCurrencyCode: "EUR", toCurrencyCode: "USD", rate: 1.08 }),
        // Otra base: se registró contra el córdoba y no sirve para convertir contra el dólar.
        exchangeRateRecord({ fromCurrencyCode: "EUR", toCurrencyCode: "NIO", rate: 39.42 }),
        // Cerrada: fue vigente y ya no lo es (el historial explica el pasado, no convierte hoy).
        exchangeRateRecord({
          fromCurrencyCode: "GBP",
          toCurrencyCode: "USD",
          rate: 1.27,
          effectiveTo: "2026-09-15T00:00:00.000Z",
        }),
      ],
    });

    const settings = await getMoneySettings(dependencies);

    expect(settings.baseCurrencyCode).toBe("USD");
    expect(settings.locale).toBe("en-US");
    expect(settings.currencies.map((currency) => currency.code)).toEqual(["USD", "NIO", "EUR"]);
    expect(settings.activeRates).toEqual({ NIO: 0.027, EUR: 1.08 });
  });

  it("sin historial no inventa tasas: el mapa queda vacío", async () => {
    const dependencies = moneyDependencies({
      settings: { baseCurrencyCode: "NIO", locale: "es-NI", updatedByUserId: null },
      currencies: [currencyRecord({ code: "NIO" }), currencyRecord({ code: "USD" })],
    });

    const settings = await getMoneySettings(dependencies);

    expect(settings.activeRates).toEqual({});
  });

  it("devuelve el catálogo conocido para completar el formulario", async () => {
    const dependencies = moneyDependencies({});

    const settings = await getMoneySettings(dependencies);

    expect(settings.knownCurrencies).toContainEqual({
      code: "USD",
      name: "Dólar estadounidense",
      symbol: "US$",
      decimals: 2,
    });
    expect(settings.knownCurrencies.length).toBeGreaterThan(5);
  });
});
