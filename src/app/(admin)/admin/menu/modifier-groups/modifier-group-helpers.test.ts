import { describe, expect, it } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import {
  describeModifierRule,
  formatOptionPriceDelta,
} from "./modifier-group-helpers";

describe("modifier group helpers", () => {
  it("explica regla obligatoria de una sola opción", () => {
    expect(
      describeModifierRule({ isRequired: true, minSelections: 1, maxSelections: 1 }),
    ).toBe("El cliente debe elegir 1 opción");
  });

  it("explica regla obligatoria con rango", () => {
    expect(
      describeModifierRule({ isRequired: true, minSelections: 1, maxSelections: 3 }),
    ).toBe("El cliente debe elegir entre 1 y 3 opciones");
  });

  it("explica regla opcional con tope", () => {
    expect(
      describeModifierRule({ isRequired: false, minSelections: 0, maxSelections: 3 }),
    ).toBe("El cliente puede elegir hasta 3 opciones");
  });

  it("explica regla opcional de una opción", () => {
    expect(
      describeModifierRule({ isRequired: false, minSelections: 0, maxSelections: 1 }),
    ).toBe("El cliente puede elegir 1 opción");
  });

  it("formatea recargos con C$ y signo", () => {
    expect(formatOptionPriceDelta(25, DEFAULT_CURRENCY_FORMAT)).toBe("+C$25.00");
    expect(formatOptionPriceDelta(-15.5, DEFAULT_CURRENCY_FORMAT)).toBe("-C$15.50");
    expect(formatOptionPriceDelta(0, DEFAULT_CURRENCY_FORMAT)).toBeNull();
  });
});
