import { describe, expect, it } from "vitest";

import {
  KNOWN_CURRENCIES,
  assertCurrencyDraft,
  currencyCodeKey,
  isSameCurrency,
  normalizeCurrencyCode,
  resolveCurrencyDraft,
} from "@/modules/money/domain/currency-catalog";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`) — **el catálogo de monedas es conveniencia, no una
 * restricción**.
 *
 * El contrato viejo era «ISO de 3 letras» (`/^[A-Z]{3}$/` en `business-settings.schema.ts`): una moneda
 * personalizada con un código interno no podía existir. El negocio opera internacionalmente, así que el
 * catálogo conoce las comunes y **acepta** las que el dueño cargue. `decimals` es del catálogo y no del
 * formateador.
 */
describe("normalizeCurrencyCode", () => {
  it("recorta y pasa a mayúsculas", () => {
    expect(normalizeCurrencyCode(" nio ")).toBe("NIO");
    expect(normalizeCurrencyCode("usd")).toBe("USD");
  });
});

describe("isSameCurrency", () => {
  it("compara sin importar el caso ni los espacios", () => {
    expect(isSameCurrency(" nio ", "NIO")).toBe(true);
    expect(isSameCurrency("USD", "NIO")).toBe(false);
  });
});

describe("currencyCodeKey", () => {
  it("es la forma canónica con la que se compara una moneda", () => {
    expect(currencyCodeKey(" usd ")).toBe("USD");
  });
});

describe("KNOWN_CURRENCIES", () => {
  it("incluye las monedas que el negocio usa, con su nombre y su símbolo", () => {
    const nio = KNOWN_CURRENCIES.find((currency) => currency.code === "NIO");

    expect(nio).toBeDefined();
    expect(nio?.symbol).toBe("C$");
    expect(nio?.decimals).toBe(2);
  });

  it("declara los decimales de cada moneda conocida", () => {
    // El yen no tiene decimales: formatearlo con dos es un bug de presentación, y guardarlo con dos es un
    // bug de dinero.
    const jpy = KNOWN_CURRENCIES.find((currency) => currency.code === "JPY");

    expect(jpy?.decimals).toBe(0);
  });
});

describe("assertCurrencyDraft", () => {
  it("acepta un código conocido y completa nombre y símbolo del catálogo", () => {
    const draft = assertCurrencyDraft({ code: "jpy" });

    expect(draft.code).toBe("JPY");
    expect(draft.isKnown).toBe(true);
    expect(draft.decimals).toBe(0);
    expect(draft.name.length).toBeGreaterThan(0);
    expect(draft.symbol.length).toBeGreaterThan(0);
  });

  it("acepta una moneda personalizada con código interno largo (D-019)", () => {
    const draft = assertCurrencyDraft({
      code: "xbt",
      name: "Bitcoin",
      symbol: "₿",
      decimals: 4,
    });

    expect(draft).toEqual({
      code: "XBT",
      name: "Bitcoin",
      symbol: "₿",
      decimals: 4,
      isKnown: false,
    });
  });

  it("exige nombre y símbolo cuando el código no está en el catálogo conocido", () => {
    expect(() => assertCurrencyDraft({ code: "ZZZ" })).toThrowError(/nombre/i);
  });

  it("rechaza un código vacío o inválido", () => {
    expect(() => assertCurrencyDraft({ code: "   " })).toThrowError(/código/i);
    expect(() => assertCurrencyDraft({ code: "REALMENTE-LARGO" })).toThrowError(/código/i);
  });

  it("rechaza decimales fuera de 0..4", () => {
    expect(() =>
      assertCurrencyDraft({ code: "ZZZ", name: "Z", symbol: "Z", decimals: 5 }),
    ).toThrowError(/decimales/i);
    expect(() =>
      assertCurrencyDraft({ code: "ZZZ", name: "Z", symbol: "Z", decimals: -1 }),
    ).toThrowError(/decimales/i);
  });
});

describe("resolveCurrencyDraft", () => {
  it("devuelve `null` en vez de tirar cuando el borrador no es válido", () => {
    expect(resolveCurrencyDraft({ code: "" })).toBeNull();
    expect(resolveCurrencyDraft({ code: "ZZZ" })).toBeNull();
  });
});
