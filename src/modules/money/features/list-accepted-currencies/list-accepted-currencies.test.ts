import { describe, expect, it } from "vitest";

import { InMemoryBusinessCurrencySettingsRepository } from "@/modules/money/adapters/in-memory-business-currency-settings-repository";
import { InMemoryCurrencyRepository } from "@/modules/money/adapters/in-memory-currency-repository";
import { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";
import type { ExchangeRateRecord } from "@/modules/money/domain/exchange-rate";

import { readAcceptedCurrencies } from "./list-accepted-currencies";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`, `A-85`) — **la lectura que un consumidor usa para
 * cobrar hoy**.
 *
 * Es la puerta única de la configuración monetaria de producción: la moneda base vigente, con qué formato se
 * muestra, qué monedas se aceptan y a qué tasa. Reemplaza a los dos escalares de `BusinessSettings` que cinco
 * consumidores leían por su cuenta (`A-83`).
 *
 * Lo que se fija:
 *
 * 1. **la base vigente sale de `money`**, no de `BusinessSettings`;
 * 2. **sólo las monedas activas** entran al contexto y a la lista: una moneda apagada no se ofrece;
 * 3. la moneda base **no lleva tasa** (su equivalente es el monto mismo) y las demás traen la suya;
 * 4. una moneda activa **sin tasa vigente** no se puede convertir, así que no entra al mapa de tasas.
 */
describe("readAcceptedCurrencies", () => {
  function setup(base = "NIO", rates: ExchangeRateRecord[] = []) {
    const currencyRepository = new InMemoryCurrencyRepository({
      currencies: [
        { id: "c1", code: "NIO", name: "Córdoba", symbol: "C$", decimals: 2, isKnown: true, isActive: true, sortOrder: 0 },
        { id: "c2", code: "USD", name: "Dólar", symbol: "US$", decimals: 2, isKnown: true, isActive: true, sortOrder: 1 },
        { id: "c3", code: "EUR", name: "Euro", symbol: "€", decimals: 2, isKnown: true, isActive: true, sortOrder: 2 },
        // Apagada: no se ofrece ni se convierte.
        { id: "c4", code: "MXN", name: "Peso mexicano", symbol: "MX$", decimals: 2, isKnown: true, isActive: false, sortOrder: 3 },
      ],
    });

    const exchangeRateRepository = new InMemoryExchangeRateRepository({ rates });

    return {
      dependencies: {
        currencyRepository,
        exchangeRateRepository,
        settingsRepository: new InMemoryBusinessCurrencySettingsRepository({
          settings: { baseCurrencyCode: base, locale: "es-NI", updatedByUserId: null },
          exchangeRateRepository,
        }),
      },
    };
  }

  it("toma la moneda base vigente de money y no lleva tasa para ella", async () => {
    const { dependencies } = setup();

    const { context, currencies } = await readAcceptedCurrencies(dependencies);

    expect(context.baseCurrencyCode).toBe("NIO");
    expect(context.locale).toBe("es-NI");
    // La base no tiene tasa: su equivalente lo escribe el snapshot como igualdad, no acá.
    expect(context.rates.NIO).toBeUndefined();
    expect(currencies.find((currency) => currency.code === "NIO")?.isBase).toBe(true);
  });

  it("deja afuera una moneda apagada, del contexto y de la lista", async () => {
    const { dependencies } = setup();

    const { context, currencies } = await readAcceptedCurrencies(dependencies);

    expect(currencies.map((currency) => currency.code)).toEqual(["NIO", "USD", "EUR"]);
    expect(context.knownCurrencyCodes).not.toContain("MXN");
  });

  it("una moneda activa sin tasa vigente queda conocida pero sin poder convertirse", async () => {
    const { dependencies } = setup();

    const { context } = await readAcceptedCurrencies(dependencies);

    // Está en el catálogo (el mensaje de error va a mandar a registrar la tasa) pero no en el mapa de tasas.
    expect(context.knownCurrencyCodes).toContain("EUR");
    expect(context.rates.EUR).toBeUndefined();
  });

  it("con la tasa registrada, la moneda entra al mapa con su número", async () => {
    const { dependencies } = setup("NIO", [
      {
        id: "rate_1",
        fromCurrencyCode: "USD",
        toCurrencyCode: "NIO",
        rate: 36.5,
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: null,
      },
    ]);

    const { context } = await readAcceptedCurrencies(dependencies);

    expect(context.rates.USD).toBe(36.5);
  });

  it("con otra base, es esa la que rige y la anterior deja de ser la igualdad", async () => {
    const { dependencies } = setup("USD");

    const { context } = await readAcceptedCurrencies(dependencies);

    expect(context.baseCurrencyCode).toBe("USD");
    expect(context.rates.USD).toBeUndefined();
  });
});
