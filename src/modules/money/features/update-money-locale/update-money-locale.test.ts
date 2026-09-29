import { describe, expect, it } from "vitest";

import { InMemoryBusinessCurrencySettingsRepository } from "@/modules/money/adapters/in-memory-business-currency-settings-repository";
import { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";

import { updateMoneyLocale } from "./update-money-locale";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-87`, `D-018`) — **cambiar el formato regional no es
 * cambiar la moneda base**.
 *
 * El modal «Cambiar formato» de Finanzas llamaba a `changeBaseCurrency({ code: base, locale })` con la base
 * **ya vigente**, y `change-base-currency` rechaza el caso con `409` («ya es la moneda base»): el único
 * camino de escritura del locale era una operación que el dominio prohíbe repetir, así que **guardar el
 * formato no guardaba nada**.
 *
 * Lo que se fija:
 *
 * 1. el locale se guarda y la moneda base **no** se toca;
 * 2. **no** se cierra ningún período de tasa: el formato es presentación, no un cambio de base;
 * 3. un locale con forma inválida se rechaza con el campo señalado.
 */
describe("updateMoneyLocale", () => {
  function setup(base = "NIO") {
    const exchangeRateRepository = new InMemoryExchangeRateRepository({
      rates: [
        {
          id: "rate_1",
          fromCurrencyCode: "USD",
          toCurrencyCode: "NIO",
          rate: 36.5,
          effectiveFrom: "2026-09-01T00:00:00.000Z",
          effectiveTo: null,
        },
      ],
    });

    return {
      exchangeRateRepository,
      dependencies: {
        settingsRepository: new InMemoryBusinessCurrencySettingsRepository({
          settings: { baseCurrencyCode: base, locale: "es-NI", updatedByUserId: null },
          exchangeRateRepository,
        }),
      },
    };
  }

  it("guarda el formato sin cambiar la moneda base", async () => {
    const { dependencies } = setup();

    const result = await updateMoneyLocale({ locale: "es-MX" }, dependencies);

    expect(result.data).toEqual({ baseCurrencyCode: "NIO", locale: "es-MX" });
  });

  it("no cierra el período de tasa vigente: el formato no es un cambio de base", async () => {
    const { dependencies, exchangeRateRepository } = setup();

    await updateMoneyLocale({ locale: "en-US" }, dependencies);

    const vigentes = await exchangeRateRepository.listActiveRatesTo("NIO");

    expect(vigentes).toHaveLength(1);
    expect(vigentes[0].effectiveTo).toBeNull();
  });

  it("rechaza un formato con forma inválida señalando el campo", async () => {
    const { dependencies } = setup();

    await expect(updateMoneyLocale({ locale: "es_NI" }, dependencies)).rejects.toMatchObject({
      status: 422,
      fields: { locale: expect.any(String) },
    });
  });

  it("sin fila de configuración el formato se guarda igual, con la base por defecto", async () => {
    const exchangeRateRepository = new InMemoryExchangeRateRepository();

    const result = await updateMoneyLocale(
      { locale: "es-CR" },
      {
        settingsRepository: new InMemoryBusinessCurrencySettingsRepository({
          settings: null,
          exchangeRateRepository,
        }),
      },
    );

    expect(result.data).toEqual({ baseCurrencyCode: "NIO", locale: "es-CR" });
  });
});
