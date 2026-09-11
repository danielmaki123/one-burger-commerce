import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BRAND_FOREGROUND_COLOR,
  checkBusinessSettingsContrast,
  contrastRatio,
  relativeLuminance,
} from "@/modules/business-settings/domain/color-contrast";
import { COLOR_PRESETS } from "@/modules/business-settings/domain/color-presets";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

describe("contraste WCAG", () => {
  it("calcula la luminancia relativa", () => {
    expect(relativeLuminance("#000000")!).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")!).toBeCloseTo(1, 5);
  });

  it("calcula el ratio de contraste", () => {
    expect(contrastRatio("#000000", "#ffffff")!).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")!).toBeCloseTo(1, 5);
    // El orden de los argumentos no cambia el resultado.
    expect(contrastRatio("#2b6c96", "#ffffff")!).toBeCloseTo(
      contrastRatio("#ffffff", "#2b6c96")!,
      5,
    );
  });

  it("devuelve null si el color no es un hex válido", () => {
    expect(relativeLuminance("azul")).toBeNull();
    expect(contrastRatio("#12345", "#ffffff")).toBeNull();
  });

  it("no genera avisos con los valores por defecto del negocio", () => {
    expect(checkBusinessSettingsContrast(DEFAULT_BUSINESS_SETTINGS)).toEqual([]);
  });

  it("avisa cuando el texto no llega a 4.5:1 sobre el lienzo", () => {
    const warnings = checkBusinessSettingsContrast({
      ...DEFAULT_BUSINESS_SETTINGS,
      foregroundColor: "#cccccc",
    });

    const bodyText = warnings.find((warning) => warning.id === "foreground-background");

    expect(bodyText).toBeDefined();
    expect(bodyText!.required).toBe(4.5);
    expect(bodyText!.ratio).toBeLessThan(4.5);
    expect(bodyText!.label).toContain("texto");
  });

  it("avisa cuando el texto claro sobre el color de marca no llega a 4.5:1", () => {
    const warnings = checkBusinessSettingsContrast({
      ...DEFAULT_BUSINESS_SETTINGS,
      primaryColor: "#eeeeee",
    });

    expect(warnings.map((warning) => warning.id)).toContain("brand-foreground-brand");
  });

  it("avisa cuando el color de marca no se distingue del fondo", () => {
    const warnings = checkBusinessSettingsContrast({
      ...DEFAULT_BUSINESS_SETTINGS,
      primaryColor: "#faf8f4",
    });

    expect(warnings.map((warning) => warning.id)).toContain("brand-background");
  });
});

describe("presets de color", () => {
  it("incluye el esquema actual del negocio", () => {
    const current = COLOR_PRESETS.find((preset) => preset.id === "actual");

    expect(current?.colors).toMatchObject({
      primaryColor: DEFAULT_BUSINESS_SETTINGS.primaryColor,
      accentColor: DEFAULT_BUSINESS_SETTINGS.accentColor,
      backgroundColor: DEFAULT_BUSINESS_SETTINGS.backgroundColor,
      foregroundColor: DEFAULT_BUSINESS_SETTINGS.foregroundColor,
      surfaceColor: DEFAULT_BUSINESS_SETTINGS.surfaceColor,
    });
  });

  it("incluye la paleta del mock completo, con sus colores reales", () => {
    // Los valores salen del mock medido (`ops/audit-checkout-mock.md`): el rojo del CTA
    // (#d32f2f), la crema del lienzo (#faf1d6), la tarjeta (#fffdf9), la tinta (#1f1916)
    // y el borde/acento (#efe2c5). El test siguiente comprueba que además sea legible.
    const mock = COLOR_PRESETS.find((preset) => preset.id === "pimienta");

    expect(mock, "falta el preset con la paleta del mock").toBeDefined();
    expect(mock!.colors).toEqual({
      primaryColor: "#d32f2f",
      accentColor: "#efe2c5",
      backgroundColor: "#faf1d6",
      foregroundColor: "#1f1916",
      surfaceColor: "#fffdf9",
    });
  });

  it("ofrece varios presets con id y nombre únicos", () => {
    expect(COLOR_PRESETS.length).toBeGreaterThanOrEqual(4);

    expect(new Set(COLOR_PRESETS.map((preset) => preset.id)).size).toBe(COLOR_PRESETS.length);
    expect(new Set(COLOR_PRESETS.map((preset) => preset.label)).size).toBe(COLOR_PRESETS.length);
  });

  it("todos los presets son legibles: ninguno dispara avisos de contraste", () => {
    for (const preset of COLOR_PRESETS) {
      expect(
        checkBusinessSettingsContrast(preset.colors),
        `el preset "${preset.label}" no cumple el contraste mínimo`,
      ).toEqual([]);
    }
  });
});

describe("contrato con el sistema visual", () => {
  it("el color de texto sobre la marca coincide con el token de globals.css", () => {
    const css = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");
    const match = /--brand-foreground:\s*(#[0-9a-fA-F]{6})/.exec(css);

    expect(match, "no se encontró --brand-foreground en globals.css").not.toBeNull();
    expect(match![1].toLowerCase()).toBe(BRAND_FOREGROUND_COLOR);
  });
});
