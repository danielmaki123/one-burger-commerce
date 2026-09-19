import { describe, expect, it } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import type { ModifierGroupRecord } from "./menu.types";
import { describeModifierGroup, formatModifierOptionPrice } from "./modifier-copy";

/**
 * El precio y la frase de un grupo de modificadores: una sola redacción para la carta y el mostrador.
 *
 * El caso del precio se movió desde `product-detail-copy` (donde vivía dentro de la carpeta de la ruta
 * pública) y la frase desde el `GroupHelper` de la ficha, que era la única copia.
 */

const grupo = (over: Partial<ModifierGroupRecord> = {}): ModifierGroupRecord => ({
  id: "grupo_1",
  name: "Extras",
  isRequired: false,
  minSelections: 0,
  maxSelections: 3,
  sortOrder: 0,
  options: [{ id: "opt_1", name: "Queso", priceDelta: 15, isActive: true }],
  ...over,
});

describe("formatModifierOptionPrice", () => {
  it("usa un único precio visible por opción", () => {
    expect(formatModifierOptionPrice(425, DEFAULT_CURRENCY_FORMAT)).toBe("+C$425.00");
    expect(formatModifierOptionPrice(0, DEFAULT_CURRENCY_FORMAT)).toBe("C$0.00");
  });
});

describe("describeModifierGroup", () => {
  it("una sola opción posible se explica como una elección", () => {
    expect(describeModifierGroup(grupo({ maxSelections: 1 }))).toBe(
      "Elegí una opción para continuar.",
    );
  });

  it("un mínimo igual al máximo pide la cantidad exacta", () => {
    expect(describeModifierGroup(grupo({ minSelections: 2, maxSelections: 2 }))).toBe(
      "Elegí exactamente 2 opciones.",
    );
  });

  it("un rango se explica con sus dos extremos", () => {
    expect(describeModifierGroup(grupo({ minSelections: 1, maxSelections: 3 }))).toBe(
      "Elegí entre 1 y 3 opciones.",
    );
  });

  it("un grupo libre no pide nada en particular", () => {
    expect(describeModifierGroup(grupo({ minSelections: 0, maxSelections: 1 }))).toBe(
      "Elegí una opción para continuar.",
    );
    expect(describeModifierGroup(grupo({ minSelections: 0, maxSelections: 0 }))).toBe(
      "Personalizá este plato a tu gusto.",
    );
  });
});
