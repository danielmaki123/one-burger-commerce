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
 * `DESIGN_REFERENCES.md` §3 Patrón 5 — la escala tipográfica del ADN visual.
 *
 * **Cambió el contrato (2026-09-15)**: antes esta tabla fijaba los pasos del mock "Artisanal Appetite"
 * (T1.3, 13 pasos de 10 a 40 px). El owner reemplazó ese ADN por el de `DESIGN_REFERENCES.md`, que
 * define **cinco niveles** (Hero 56, KPI 32, Título 20, Body 14, Label 11) más un metadato de apoyo.
 * Los nombres viejos siguen existiendo porque el público los usa, pero ahora **mapean a esos cinco
 * niveles**: `display`/`display-lg` = Hero, `headline*` = Título, `title`/`title-sm` = KPI,
 * `body-sm` = Body, `label*` = Label.
 *
 * `globals.css` es la única fuente de verdad para el runtime, y este test es lo que impide que la
 * escala se afloje sin que nadie se entere.
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

const ADN_TYPE_SCALE: {
  token: string;
  size: string;
  lineHeight: string;
  weight: string;
  tracking?: string;
}[] = [
  // Hero — el dato principal (56 px) y su alias de escritorio.
  { token: "display", size: "3.5rem", lineHeight: "3.75rem", weight: "700", tracking: "-0.03em" },
  { token: "display-lg", size: "3.5rem", lineHeight: "3.75rem", weight: "700", tracking: "-0.03em" },
  // KPI — datos secundarios (32 px) en Fraunces.
  { token: "kpi", size: "2rem", lineHeight: "2.5rem", weight: "700", tracking: "-0.02em" },
  { token: "title", size: "2rem", lineHeight: "2.5rem", weight: "700", tracking: "-0.02em" },
  { token: "title-sm", size: "1.25rem", lineHeight: "1.625rem", weight: "600" },
  // Título de sección (20 px, Inter 600).
  { token: "headline", size: "1.25rem", lineHeight: "1.625rem", weight: "600", tracking: "-0.01em" },
  { token: "headline-md", size: "1.25rem", lineHeight: "1.625rem", weight: "600", tracking: "-0.01em" },
  { token: "headline-lg", size: "1.5rem", lineHeight: "1.875rem", weight: "600", tracking: "-0.01em" },
  // Body (14 px).
  { token: "body", size: "0.875rem", lineHeight: "1.375rem", weight: "400" },
  { token: "body-sm", size: "0.875rem", lineHeight: "1.375rem", weight: "400" },
  // Label (11 px, uppercase con tracking ancho) y el metadato de apoyo.
  { token: "label", size: "0.6875rem", lineHeight: "1rem", weight: "600", tracking: "0.08em" },
  { token: "label-sm", size: "0.6875rem", lineHeight: "1rem", weight: "600", tracking: "0.08em" },
  { token: "label-xs", size: "0.6875rem", lineHeight: "1rem", weight: "700", tracking: "0.08em" },
  { token: "caption", size: "0.75rem", lineHeight: "1rem", weight: "400" },
];

describe("tokens del ADN visual (escala tipográfica, radios y sombras)", () => {
  const tokens = themeTokens(readFileSync(GLOBALS_CSS, "utf8"));

  it("define la escala del ADN con su tamaño, interlineado y peso", () => {
    for (const step of ADN_TYPE_SCALE) {
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
        `--text-${reserved} es de Tailwind: la escala del ADN usa nombres propios`,
      ).toBe(false);
    }
  });

  it("los cinco niveles nunca se mezclan: el Hero es el techo y el Label el piso", () => {
    const hero = remValue(tokens, "--text-display");
    const kpi = remValue(tokens, "--text-kpi");
    const title = remValue(tokens, "--text-headline");
    const body = remValue(tokens, "--text-body");
    const label = remValue(tokens, "--text-label");

    // El orden del ADN: Hero > KPI > Título > Body > Label. Un paso intermedio que se cuele
    // rompe la jerarquía de 5 niveles que pide el Patrón 5.
    expect(hero).toBeGreaterThan(kpi);
    expect(kpi).toBeGreaterThan(title);
    expect(title).toBeGreaterThan(body);
    expect(body).toBeGreaterThan(label);
  });

  it("el dato principal es 56 px y el label 11 px, como dice el ADN", () => {
    expect(remValue(tokens, "--text-display")).toBe(3.5);
    expect(remValue(tokens, "--text-label")).toBe(0.6875);
  });

  it("define las curvaturas del ADN (tarjeta 16 px, panel 24 px)", () => {
    expect(tokens.get("--radius-card")).toBe("1rem");
    expect(tokens.get("--radius-panel")).toBe("1.5rem");
  });

  it("define las tres elevaciones teñidas con el color configurado", () => {
    for (const token of ["--shadow-card", "--shadow-raised", "--shadow-float"]) {
      const value = tokens.get(token);
      expect(value, `falta ${token}`).toBeDefined();
      // Si la sombra no sale de `--brand`, deja de seguir la apariencia del admin.
      expect(value, `${token} debe teñirse con var(--brand)`).toContain("var(--brand)");
    }
  });
});
