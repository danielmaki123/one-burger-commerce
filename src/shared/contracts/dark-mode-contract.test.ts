import { describe, expect, it } from "vitest";

import { TEXT_CONTRAST_MIN, contrastRatio } from "@/modules/business-settings/domain/color-contrast";

import { fileExists, readRepoFile } from "./contract-files";

/**
 * El modo oscuro del panel y sus contrastes — sistema Stitch (`ops/references/stitch/design-system.md`).
 *
 * **Cambió el contrato (2026-09-16).** Antes este archivo medía los pares del ADN viejo
 * (`--success-strong`, `--brand-strong`, …) con los valores de `DESIGN_REFERENCES.md`. El owner
 * reemplazó ese sistema por el de Stitch y pidió el panel en oscuro, así que ahora mide **la paleta
 * del sistema nuevo**, con dos arreglos que salieron de medirla:
 *
 * - `--text-muted`: el `#64748B` del documento da **3.30:1** sobre la tarjeta (no llega a AA). Se usa
 *   `#8296AD`, que da **5.17:1**.
 * - `--border-control`: el borde de un control tiene que dar **3:1** (WCAG 1.4.11) y el
 *   `--border-subtle` del documento da **1.01:1**. Los controles usan `rgba(255,255,255,.40)` →
 *   **3.23:1**.
 *
 * Y una **deuda declarada** que este archivo fija a propósito: el modo claro usa los valores del
 * documento tal cual, y ahí `--brand-primary` (#38BDF8) da 2.14:1 sobre blanco — sirve como relleno,
 * no como texto. El owner pidió dejarlo así y documentarlo; cuando se use el modo claro para
 * facturación hay que oscurecer esos dos colores.
 */

const GLOBALS_CSS = "src/app/globals.css";
const ADMIN_EDIT_SHEET = "src/app/(admin)/admin/_components/admin-edit-sheet.tsx";

/** Los 16 tokens muertos que se eliminaron: si vuelven, es una fuga, no una decisión. */
const FORBIDDEN_TOKENS = [
  "--primary",
  "--primary-foreground",
  "--popover",
  "--popover-foreground",
  "--accent-foreground",
  "--destructive",
  "--ink-green-foreground",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
];

/** Cuerpo de un bloque `selector { … }` contando llaves anidadas. */
function blockOf(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `falta el bloque ${selector} en ${GLOBALS_CSS}`).toBeGreaterThan(-1);

  const open = css.indexOf("{", start);
  let depth = 0;

  for (let index = open; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open, index);
    }
  }

  throw new Error(`el bloque ${selector} no cierra`);
}

/** El valor crudo de un token, siguiendo un nivel de `var()`. */
function rawToken(block: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(block);
  expect(match, `falta ${name} en el bloque`).toBeTruthy();

  const raw = match![1].trim();
  const reference = /^var\((--[\w-]+)\)$/.exec(raw);

  return reference ? rawToken(block, reference[1]) : raw;
}

function hexChannels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Compone un `rgba()` sobre un color de fondo y devuelve el hex que se ve. */
function composite(foreground: string, backgroundHex: string): string {
  const rgba = /^rgba?\(([^)]+)\)$/.exec(foreground);
  if (!rgba) return foreground;

  const parts = rgba[1].split(",").map((part) => Number.parseFloat(part.trim()));
  const [r, g, b] = parts;
  const alpha = parts.length > 3 ? parts[3] : 1;
  const base = hexChannels(backgroundHex);

  const mixed = [r, g, b].map((channel, index) =>
    Math.round(channel * alpha + base[index] * (1 - alpha)),
  );

  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const css = readRepoFile(GLOBALS_CSS);
const lightBlock = blockOf(css, ":root {");
const darkBlock = blockOf(css, ".dark {");

describe("contrato · modo oscuro del panel (sistema Stitch)", () => {
  it("el interruptor existe, con color-scheme para los controles nativos", () => {
    expect(darkBlock).toContain("color-scheme: dark");
  });

  it("los textos del sistema llegan a 4.5:1 sobre las superficies oscuras", () => {
    const pairs: Array<[string, string]> = [
      ["--text-primary", "--bg-surface"],
      ["--text-primary", "--bg-surface-card"],
      ["--text-secondary", "--bg-surface"],
      ["--text-secondary", "--bg-surface-card"],
      ["--text-muted", "--bg-surface"],
      ["--text-muted", "--bg-surface-card"],
      ["--brand-primary", "--bg-surface"],
    ];

    const offenders = pairs
      .map(([foreground, background]) => ({
        label: `${foreground} sobre ${background}`,
        ratio: contrastRatio(rawToken(darkBlock, foreground), rawToken(darkBlock, background)) ?? 0,
      }))
      .filter((pair) => pair.ratio < TEXT_CONTRAST_MIN)
      .map((pair) => `${pair.label}: ${pair.ratio.toFixed(2)}:1 (mínimo ${TEXT_CONTRAST_MIN})`);

    expect(offenders, "un par del panel por debajo de AA no se ve a 1,5 m de la pantalla").toEqual([]);
  });

  it("los cuatro estados operativos se leen sobre su propio fondo", () => {
    const card = rawToken(darkBlock, "--bg-surface-card");

    const offenders = ["pending", "prep", "ready", "sla"]
      .map((state) => ({
        state,
        ratio:
          contrastRatio(
            rawToken(darkBlock, `--status-${state}-text`),
            composite(rawToken(darkBlock, `--status-${state}-bg`), card),
          ) ?? 0,
      }))
      .filter((entry) => entry.ratio < TEXT_CONTRAST_MIN)
      .map((entry) => `${entry.state}: ${entry.ratio.toFixed(2)}:1`);

    expect(offenders, "un estado que no se lee es un pedido que se pierde").toEqual([]);
  });

  it("el texto oscuro sobre los rellenos brillantes del sistema se lee", () => {
    // Los botones del sistema son `bg-sky-400 text-slate-950` y `bg-amber-500 text-slate-950`: si el
    // texto claro se colara (como en el sistema anterior), el contraste caería a ~2:1.
    for (const fill of ["--brand-primary", "--brand-amber"]) {
      const ratio = contrastRatio(rawToken(darkBlock, "--text-inverse"), rawToken(darkBlock, fill)) ?? 0;
      expect(ratio, `--text-inverse sobre ${fill}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        TEXT_CONTRAST_MIN,
      );
    }
  });

  it("el borde de un control llega a 3:1 (WCAG 1.4.11)", () => {
    const surface = rawToken(darkBlock, "--bg-surface");
    const border = composite(rawToken(darkBlock, "--border-control"), surface);
    const ratio = contrastRatio(border, surface) ?? 0;

    expect(
      ratio,
      `el borde de control da ${ratio.toFixed(2)}:1: el documento pide 3:1 para distinguir el control del fondo`,
    ).toBeGreaterThanOrEqual(3);
  });

  it("los dos arreglos de contraste están puestos y no se revierten", () => {
    expect(rawToken(darkBlock, "--text-muted").toUpperCase(), "el #64748B del documento da 3.30:1").toBe(
      "#8296AD",
    );
    expect(rawToken(darkBlock, "--border-control").replace(/\s+/g, "")).toBe("rgba(255,255,255,0.4)");
  });

  it("la deuda del modo claro queda fijada y visible", () => {
    // El owner pidió dejar el modo claro como está y documentarlo: estos son los valores del
    // documento, que sirven como relleno pero **no** como texto (2.1–2.5:1 sobre blanco).
    expect(rawToken(lightBlock, "--brand-primary")).toBe("#38bdf8");
    expect(rawToken(lightBlock, "--brand-amber")).toBe("#f59e0b");
    expect(rawToken(lightBlock, "--text-muted")).toBe("#94a3b8");
    expect(css, "la deuda tiene que estar escrita donde se lee").toContain("DEUDA DECLARADA");
  });

  it("no vuelven los 16 tokens muertos que se eliminaron", () => {
    const declared = FORBIDDEN_TOKENS.filter((name) => new RegExp(`^\\s*${name}:`, "m").test(css));

    expect(
      declared,
      "un token sin consumidor se borra del CSS en vez de quedar como superficie muerta",
    ).toEqual([]);
  });

  it("el sistema oficial está versionado en el repo", () => {
    expect(fileExists("ops/references/stitch/design-system.md")).toBe(true);
  });

  it("los modales del panel llevan el alcance oscuro (portal fuera del shell)", () => {
    // La hoja se monta con `createPortal(document.body)`, o sea **fuera** del `<div class="dark">` del
    // shell: sin la clase en su propio contenedor hereda los tokens del modo claro y todo modal sale
    // blanco dentro de un panel oscuro (pasó hasta el 2026-09-17). Es el mismo truco que usa el login.
    const source = readRepoFile(ADMIN_EDIT_SHEET);

    expect(source).toContain("createPortal");
    expect(source).toContain('className="dark fixed inset-0');
  });
});