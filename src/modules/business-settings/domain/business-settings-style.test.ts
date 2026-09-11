import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { businessSettingsStyleVariables } from "@/modules/business-settings/domain/business-settings-style";
import {
  FONT_CHOICES,
  type FontChoice,
} from "@/modules/business-settings/domain/business-settings.types";

describe("businessSettingsStyleVariables", () => {
  it("traduce la configuración a tokens CSS", () => {
    expect(
      businessSettingsStyleVariables({
        ...DEFAULT_BUSINESS_SETTINGS,
        primaryColor: "#112233",
        accentColor: "#445566",
        backgroundColor: "#778899",
        foregroundColor: "#aabbcc",
        surfaceColor: "#ddeeff",
        headingFont: "inter",
        bodyFont: "fraunces",
      }),
    ).toEqual({
      "--brand": "#112233",
      "--accent": "#445566",
      "--background": "#778899",
      "--foreground": "#aabbcc",
      "--card": "#ddeeff",
      "--font-heading": "var(--font-inter)",
      "--font-body": "var(--font-fraunces)",
    });
  });

  it("vive fuera de un módulo cliente para que el layout de servidor pueda llamarlo", () => {
    const source = readFileSync(
      path.resolve(__dirname, "./business-settings-style.ts"),
      "utf8",
    );

    // El layout raíz es un componente de servidor: si este helper se exporta
    // desde un módulo con "use client", Next falla en tiempo de render con
    // "Attempted to call businessSettingsStyleVariables() from the server".
    expect(source.startsWith('"use client"') || source.startsWith("'use client'")).toBe(false);
  });

  it("traduce la tipografía elegida sin depender de una lista fija", () => {
    // Con dos opciones alcanzaba un ternario; con tres, cualquier lista fija
    // manda al usuario a otra tipografía sin avisar.
    for (const font of FONT_CHOICES) {
      const variables = businessSettingsStyleVariables({
        ...DEFAULT_BUSINESS_SETTINGS,
        headingFont: font,
        bodyFont: font,
      }) as Record<string, string>;

      expect(variables["--font-heading"]).toBe(`var(--font-${font})`);
      expect(variables["--font-body"]).toBe(`var(--font-${font})`);
    }
  });
});

/**
 * T1.2 — toda tipografía que el admin ofrece tiene que existir en el build.
 *
 * `localFont` no carga nada si el archivo no está, y la variable CSS queda sin
 * definir: el navegador cae a la tipografía del sistema sin ningún error. Este
 * test es el que impide que eso pase desapercibido.
 */
const FONT_ASSETS: Record<FontChoice, string> = {
  fraunces: "fraunces",
  inter: "inter",
  jakarta: "plus-jakarta-sans",
};

describe("tipografías elegibles", () => {
  const layout = readFileSync(path.resolve(__dirname, "../../../app/layout.tsx"), "utf8");
  const fontFiles = readdirSync(path.resolve(__dirname, "../../../app/fonts"));

  it("cada opción del admin tiene sus dos pesos en el build", () => {
    for (const choice of FONT_CHOICES) {
      const base = FONT_ASSETS[choice];
      expect(fontFiles, `falta src/app/fonts/${base}-regular.ttf`).toContain(
        `${base}-regular.ttf`,
      );
      expect(fontFiles, `falta src/app/fonts/${base}-bold.ttf`).toContain(`${base}-bold.ttf`);
    }
  });

  it("cada opción declara su variable CSS en el layout raíz", () => {
    for (const choice of FONT_CHOICES) {
      expect(layout, `falta --font-${choice} en layout.tsx`).toContain(
        `variable: "--font-${choice}"`,
      );
      expect(layout, `${FONT_ASSETS[choice]} no se carga en layout.tsx`).toContain(
        `${FONT_ASSETS[choice]}-regular.ttf`,
      );
    }
  });

  it("el layout aplica todas las variables al documento, sin elegir a mano", () => {
    // Si el className nombra las tipografías una por una, agregar la tercera y
    // olvidarse de la lista deja la variable sin definir en el navegador.
    expect(layout).toMatch(/className=\{fontVariables\}/);
  });
});

/**
 * T1.3 — escala tipográfica, radios y sombras del mock (`DESIGN.md` de
 * "Artisanal Appetite") mapeados a tokens de `globals.css`.
 *
 * El mock no se versiona (es material de referencia), así que la especificación
 * vive acá: estos números son los del contrato de diseño medido en
 * `ops/audit-checkout-mock.md`. `globals.css` es la única fuente de verdad para
 * el runtime, y este test es lo que impide que los tokens se aflojen sin que
 * nadie se entere.
 */
const GLOBALS_CSS = path.resolve(__dirname, "../../../app/globals.css");

/** Declaraciones de los bloques `@theme` (ahí Tailwind genera las utilidades). */
function themeTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const block of css.matchAll(/@theme[^{]*\{([\s\S]*?)\n\}/g)) {
    for (const line of block[1].split("\n")) {
      const match = line.match(/^\s*(--[\w-]+)\s*:\s*([^;]+);/);
      if (match) tokens.set(match[1], match[2].trim());
    }
  }
  return tokens;
}

/** `1.875rem` → `1.875`; falla si el token no está en rem (así no se cuela un `px`). */
function remValue(tokens: Map<string, string>, token: string): number {
  const value = tokens.get(token);
  expect(value, `falta ${token} en globals.css`).toBeDefined();
  const match = value!.match(/^([\d.]+)rem$/);
  expect(match, `${token} debe estar en rem (no en px) para respetar el zoom: ${value}`).not.toBeNull();
  return Number(match![1]);
}

const MOCK_TYPE_SCALE: {
  token: string;
  size: string;
  lineHeight: string;
  weight: string;
  tracking?: string;
}[] = [
  // display-lg-mobile / display-lg
  { token: "display", size: "1.875rem", lineHeight: "2.375rem", weight: "800", tracking: "-0.02em" },
  { token: "display-lg", size: "2.5rem", lineHeight: "3rem", weight: "800", tracking: "-0.03em" },
  // headline-lg-mobile / headline-lg / headline-md
  { token: "headline", size: "1.375rem", lineHeight: "1.75rem", weight: "700", tracking: "-0.01em" },
  { token: "headline-lg", size: "1.75rem", lineHeight: "2.25rem", weight: "700", tracking: "-0.02em" },
  { token: "headline-md", size: "1.25rem", lineHeight: "1.625rem", weight: "700", tracking: "-0.01em" },
  // title-lg / title-md
  { token: "title", size: "1.0625rem", lineHeight: "1.375rem", weight: "700" },
  { token: "title-sm", size: "0.9375rem", lineHeight: "1.25rem", weight: "600" },
  // body-lg / body-md / body-sm
  { token: "body", size: "1rem", lineHeight: "1.5rem", weight: "400" },
  { token: "body-sm", size: "0.875rem", lineHeight: "1.25rem", weight: "400" },
  { token: "caption", size: "0.75rem", lineHeight: "1rem", weight: "400" },
  // label-lg / label-md / label-sm
  { token: "label", size: "0.875rem", lineHeight: "1.125rem", weight: "700", tracking: "0.01em" },
  { token: "label-sm", size: "0.75rem", lineHeight: "1rem", weight: "600", tracking: "0.02em" },
  { token: "label-xs", size: "0.75rem", lineHeight: "1rem", weight: "700", tracking: "0.04em" },
];

describe("tokens del mock (escala tipográfica, radios y sombras)", () => {
  const tokens = themeTokens(readFileSync(GLOBALS_CSS, "utf8"));

  it("define la escala tipográfica del mock con su tamaño, interlineado y peso", () => {
    for (const step of MOCK_TYPE_SCALE) {
      const { token, size, lineHeight, weight, tracking } = step;
      expect(tokens.get(`--text-${token}`), `falta --text-${token}`).toBe(size);
      expect(
        tokens.get(`--text-${token}--line-height`),
        `falta --text-${token}--line-height`,
      ).toBe(lineHeight);
      expect(
        tokens.get(`--text-${token}--font-weight`),
        `falta --text-${token}--font-weight`,
      ).toBe(weight);
      if (tracking) {
        expect(
          tokens.get(`--text-${token}--letter-spacing`),
          `falta --text-${token}--letter-spacing`,
        ).toBe(tracking);
      }
    }
  });

  it("no pisa la escala propia de Tailwind (la del admin sigue igual)", () => {
    for (const reserved of ["sm", "base", "lg", "xl", "2xl", "3xl", "4xl"]) {
      expect(
        tokens.has(`--text-${reserved}`),
        `--text-${reserved} es de Tailwind: la escala del mock usa nombres propios`,
      ).toBe(false);
    }
  });

  it("cada variante de escritorio es más grande que su base mobile-first", () => {
    for (const [base, desktop] of [
      ["--text-display", "--text-display-lg"],
      ["--text-headline", "--text-headline-lg"],
    ]) {
      expect(remValue(tokens, desktop)).toBeGreaterThan(remValue(tokens, base));
    }
    expect(remValue(tokens, "--text-label-xs")).toBeGreaterThanOrEqual(remValue(tokens, "--text-label-sm"));
  });

  it("el paso más chico no baja de los 12 px del mock", () => {
    const smallest = MOCK_TYPE_SCALE.map((step) => remValue(tokens, `--text-${step.token}`)).reduce(
      (min, value) => Math.min(min, value),
    );

    // El mock usa 10 px en los badges (`label-sm`); en un teléfono real no se lee.
    expect(smallest).toBeGreaterThanOrEqual(0.75);
  });

  it("define las curvaturas del mock (tarjeta 16 px, panel 24 px)", () => {
    expect(tokens.get("--radius-card")).toBe("1rem");
    expect(tokens.get("--radius-panel")).toBe("1.5rem");
  });

  it("define las tres elevaciones del mock teñidas con el color configurado", () => {
    for (const token of ["--shadow-card", "--shadow-raised", "--shadow-float"]) {
      const value = tokens.get(token);
      expect(value, `falta ${token}`).toBeDefined();
      // Si la sombra no sale de `--brand`, deja de seguir la apariencia del admin.
      expect(value, `${token} debe teñirse con var(--brand)`).toContain("var(--brand)");
    }
  });
});
