import { describe, expect, it } from "vitest";

import { InMemoryBusinessCurrencySettingsRepository } from "@/modules/money/adapters/in-memory-business-currency-settings-repository";
import { InMemoryCurrencyRepository } from "@/modules/money/adapters/in-memory-currency-repository";
import { InMemoryExchangeRateRepository } from "@/modules/money/adapters/in-memory-exchange-rate-repository";
import { MoneyError } from "@/modules/money/domain/money-errors";
import { currencyRecord } from "@/shared/testing/money-fixtures";

import { saveCurrency } from "./save-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`, invariante 14) — **el catálogo de monedas**.
 *
 * Tres reglas, y las tres son de dinero:
 *
 * 1. **Se valida el borrador** (`assertCurrencyDraft`): el catálogo conoce las monedas comunes y
 *    **acepta** una personalizada, pero una personalizada sin nombre ni símbolo no se puede mostrar ni
 *    convertir.
 * 2. **Un alta duplicada es un conflicto**, no un pisado silencioso: el código es la identidad, y cargar
 *    dos veces la misma moneda cambiaría en silencio con qué decimales se redondea.
 * 3. **Nada se borra**: la baja es `setCurrencyActive(false)`, porque un cobro de ayer sigue nombrando su
 *    moneda. Y la moneda base vigente no se puede apagar: dejaría al negocio sin base.
 */
function dependencies(input: {
  baseCurrencyCode?: string;
  currencies?: ReturnType<typeof currencyRecord>[];
}) {
  const repository = new InMemoryCurrencyRepository({ currencies: input.currencies ?? [] });
  const settingsRepository = new InMemoryBusinessCurrencySettingsRepository({
    settings: {
      baseCurrencyCode: input.baseCurrencyCode ?? "NIO",
      locale: "es-NI",
      updatedByUserId: null,
    },
    exchangeRateRepository: new InMemoryExchangeRateRepository(),
  });

  return { repository, settingsRepository };
}

describe("saveCurrency", () => {
  it("da de alta una moneda conocida con los datos del catálogo", async () => {
    const { repository, settingsRepository } = dependencies({});

    const { data } = await saveCurrency(
      { code: " eur " },
      { repository, settingsRepository },
    );

    expect(data).toMatchObject({
      code: "EUR",
      name: "Euro",
      symbol: "€",
      decimals: 2,
      isKnown: true,
      isActive: true,
    });
    expect((await repository.listCurrencies()).map((currency) => currency.code)).toEqual(["EUR"]);
  });

  it("da de alta una moneda personalizada con su nombre, su símbolo y sus decimales", async () => {
    const { repository, settingsRepository } = dependencies({});

    const { data } = await saveCurrency(
      { code: "btc", name: "Bitcoin", symbol: "₿", decimals: 4 },
      { repository, settingsRepository },
    );

    expect(data).toMatchObject({
      code: "BTC",
      name: "Bitcoin",
      symbol: "₿",
      decimals: 4,
      isKnown: false,
      isActive: true,
    });
  });

  it("rechaza un alta duplicada con un conflicto en vez de pisar la moneda que ya está", async () => {
    const { repository, settingsRepository } = dependencies({
      currencies: [currencyRecord({ code: "USD", decimals: 2 })],
    });

    await expect(
      saveCurrency({ code: "usd", name: "Dólar paralelo", symbol: "US$", decimals: 0 }, {
        repository,
        settingsRepository,
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    const usd = await repository.findCurrencyByCode("USD");

    expect(usd).toMatchObject({ name: "USD", decimals: 2 });
  });

  it("una moneda personalizada sin nombre ni símbolo no se puede cargar", async () => {
    const { repository, settingsRepository } = dependencies({});

    await expect(
      saveCurrency({ code: "XXX" }, { repository, settingsRepository }),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      fields: { name: expect.stringContaining("nombre") },
    });

    expect(await repository.listCurrencies()).toEqual([]);
  });

  it("la baja apaga la moneda: no la borra", async () => {
    const { repository, settingsRepository } = dependencies({
      currencies: [
        currencyRecord({ code: "NIO", sortOrder: 0 }),
        currencyRecord({ code: "EUR", sortOrder: 1 }),
      ],
    });

    const { data } = await saveCurrency(
      { code: "EUR", mode: "update", isActive: false },
      { repository, settingsRepository },
    );

    expect(data.isActive).toBe(false);
    // Sigue en el catálogo: un cobro de ayer la nombra.
    expect((await repository.listCurrencies()).map((currency) => currency.code)).toEqual([
      "NIO",
      "EUR",
    ]);
  });

  it("no deja apagar la moneda base vigente", async () => {
    const { repository, settingsRepository } = dependencies({
      baseCurrencyCode: "NIO",
      currencies: [
        currencyRecord({ code: "NIO", sortOrder: 0 }),
        currencyRecord({ code: "USD", sortOrder: 1 }),
      ],
    });

    await expect(
      saveCurrency({ code: "NIO", mode: "update", isActive: false }, { repository, settingsRepository }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("moneda base"),
    });

    expect((await repository.findCurrencyByCode("NIO"))?.isActive).toBe(true);
  });

  it("no deja el catálogo sin ninguna moneda activa", async () => {
    const { repository, settingsRepository } = dependencies({
      // La base todavía no está en el catálogo (base sin migrar): la única activa es la otra moneda.
      baseCurrencyCode: "NIO",
      currencies: [currencyRecord({ code: "EUR" })],
    });

    await expect(
      saveCurrency({ code: "EUR", mode: "update", isActive: false }, { repository, settingsRepository }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("editar una moneda que no está en el catálogo es un 404, no un alta encubierta", async () => {
    const { repository, settingsRepository } = dependencies({});

    await expect(
      saveCurrency({ code: "EUR", mode: "update" }, { repository, settingsRepository }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });

    expect(await repository.listCurrencies()).toEqual([]);
  });

  it("sin código no hay moneda", async () => {
    const { repository, settingsRepository } = dependencies({});

    await expect(
      saveCurrency({ code: "  " }, { repository, settingsRepository }),
    ).rejects.toBeInstanceOf(MoneyError);
  });
});
