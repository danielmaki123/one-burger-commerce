import { describe, expect, it } from "vitest";

import {
  CATEGORY_DARK_TEXT,
  CATEGORY_LIGHT_TEXT,
  categoryColorContrastWarning,
  normalizeCategoryColor,
  resolveCategoryCardColors,
} from "@/modules/menu/domain/category-color";

/**
 * T3.1 — color por categoría (pedido del owner).
 *
 * El mock pinta cada tarjeta del menú con el color de su categoría. El color lo
 * elige el owner en el admin, así que el texto encima **no puede quedar
 * ilegible**: se elige el más legible de los dos candidatos y, si ninguno llega
 * a AA, el admin avisa.
 */
describe("normalizeCategoryColor", () => {
  it("acepta hex de 6 dígitos y lo normaliza a minúsculas", () => {
    expect(normalizeCategoryColor("#D32F2F")).toBe("#d32f2f");
    expect(normalizeCategoryColor("  #FAF1D6 ")).toBe("#faf1d6");
  });

  it("trata el vacío como 'sin color'", () => {
    expect(normalizeCategoryColor(null)).toBeNull();
    expect(normalizeCategoryColor(undefined)).toBeNull();
    expect(normalizeCategoryColor("")).toBeNull();
    expect(normalizeCategoryColor("   ")).toBeNull();
  });

  it("rechaza lo que no es un color válido", () => {
    expect(normalizeCategoryColor("rojo")).toBeNull();
    expect(normalizeCategoryColor("#12345")).toBeNull();
    expect(normalizeCategoryColor("#12345g")).toBeNull();
    expect(normalizeCategoryColor("rgb(1,2,3)")).toBeNull();
  });
});

describe("resolveCategoryCardColors", () => {
  it("sin color devuelve null: la tarjeta usa el diseño del sistema", () => {
    expect(resolveCategoryCardColors(null)).toBeNull();
    expect(resolveCategoryCardColors("rojo")).toBeNull();
  });

  it("sobre un rojo oscuro usa texto claro (4,75:1)", () => {
    expect(resolveCategoryCardColors("#d32f2f")).toEqual({
      backgroundColor: "#d32f2f",
      foregroundColor: CATEGORY_LIGHT_TEXT,
    });
  });

  it("sobre un color claro usa texto oscuro (15,4:1)", () => {
    expect(resolveCategoryCardColors("#faf1d6")).toEqual({
      backgroundColor: "#faf1d6",
      foregroundColor: CATEGORY_DARK_TEXT,
    });
  });

  it("sobre un gris medio elige el mejor de los dos, aunque no llegue a AA", () => {
    expect(resolveCategoryCardColors("#808080")).toEqual({
      backgroundColor: "#808080",
      foregroundColor: CATEGORY_DARK_TEXT,
    });
  });
});

describe("categoryColorContrastWarning", () => {
  it("no avisa cuando el color elegido tiene texto legible", () => {
    expect(categoryColorContrastWarning("#d32f2f")).toBeNull();
    expect(categoryColorContrastWarning("#faf1d6")).toBeNull();
    expect(categoryColorContrastWarning(null)).toBeNull();
  });

  it("avisa con el ratio real cuando ninguno de los dos textos llega a AA", () => {
    const warning = categoryColorContrastWarning("#808080");

    expect(warning).not.toBeNull();
    expect(warning!.required).toBe(4.5);
    expect(warning!.ratio).toBeCloseTo(4.4, 1);
  });

  it("no avisa por un color inválido: eso lo rechaza la validación", () => {
    expect(categoryColorContrastWarning("rojo")).toBeNull();
  });
});
