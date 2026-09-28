import { describe, expect, it } from "vitest";

import { formatMoney } from "@/modules/money/domain/format-money";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — **el único formato de dinero**.
 *
 * La auditoría midió el formato «otra moneda con su código» escrito **siete veces** y los decimales fijos
 * en 2. Acá la moneda es un dato del catálogo: su símbolo, su código y **sus** decimales. Las siete copias
 * colapsan en esta función.
 */
describe("formatMoney", () => {
  it("antepone el símbolo y usa el locale para los separadores", () => {
    expect(formatMoney(1234.5, { symbol: "C$", locale: "es-NI" })).toBe("C$1,234.50");
  });

  it("respeta los decimales de la moneda (una moneda de 0 no muestra centavos)", () => {
    expect(formatMoney(1234, { symbol: "¥", locale: "es-NI", decimals: 0 })).toBe("¥1,234");
  });

  it("con el código muestra la moneda explícita, porque el símbolo solo no distingue", () => {
    // `$` es el símbolo de una docena de monedas: cuando hay más de una en pantalla, el código es el dato.
    expect(formatMoney(20, { symbol: "US$", locale: "es-NI", code: "USD" })).toBe("US$20.00 USD");
  });

  it("no imprime `NaN` ni `Infinity`: un número roto se muestra como cero", () => {
    expect(formatMoney(Number.NaN, { symbol: "C$", locale: "es-NI" })).toBe("C$0.00");
  });

  it("usa el default del negocio cuando no se le pasa formato", () => {
    expect(formatMoney(10)).toBe("C$10.00");
  });
});
