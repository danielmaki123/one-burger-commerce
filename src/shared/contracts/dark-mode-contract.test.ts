import { describe, expect, it } from "vitest";

import { TEXT_CONTRAST_MIN, contrastRatio } from "@/modules/business-settings/domain/color-contrast";

import { fileExists, readRepoFile } from "./contract-files";

/**
 * `DESIGN_REFERENCES.md` §3 Patrón 10 y §4 — el modo oscuro, con sus reglas.
 *
 * El owner **aprobó el dark mode el 2026-09-15** (antes estaba fuera de alcance y C1-3 había borrado
 * el bloque `.dark`). Esto reemplaza a `dead-tokens-contract.test.ts`: lo que antes se prohibía ahora
 * es una funcionalidad, así que el contrato cambia de pregunta —ya no «¿hay un bloque oscuro?» sino
 * **«¿el bloque oscuro es real y legible?»**— y sigue cuidando que no vuelvan los tokens muertos.
 *
 * Cuatro reglas, todas verificables:
 *
 * 1. **El interruptor existe**: `.dark` con `color-scheme: dark` (sin eso los controles nativos del
 *    navegador —selects, scrollbars, date pickers— se quedan claros sobre una pantalla oscura).
 * 2. **Los pares del ADN están**: los tokens de `DESIGN_REFERENCES.md` §4 existen en `:root` y en
 *    `.dark`; un token que solo vive en el modo claro es un componente que se rompe en oscuro.
 * 3. **Contraste ≥4.5:1 en los dos modos**, medido con la misma función que usa el producto
 *    (`contrastRatio`). Un par nuevo que no cumpla hace fallar este test.
 * 4. **Los tokens muertos no vuelven**: los 16 que C1-3 eliminó siguen sin declararse.
 */

const GLOBALS_CSS = "src/app/globals.css";

/** Tokens del ADN que tienen que existir en los dos modos (nombre sin `--`). */
const REQUIRED_IN_BOTH_MODES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "border",
  "muted",
  "muted-foreground",
  "brand",
  "brand-foreground",
  "success-soft",
  "success-strong",
  "warning-soft",
  "warning-strong",
  "danger-soft",
  "danger-strong",
  "info-soft",
  "info-strong",
];

/** Pares texto/fondo del ADN: el primero se lee sobre el segundo. */
const CONTRAST_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["success-strong", "success-soft"],
  ["warning-strong", "warning-soft"],
  ["danger-strong", "danger-soft"],
  ["info-strong", "info-soft"],
  ["brand-foreground", "brand"],
];

/** Los 16 tokens que C1-3 borró: si vuelven, es una fuga, no una decisión. */
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

/** Extrae el cuerpo de un bloque `selector { … }` contando llaves anidadas. */
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

/** Resuelve un token a hex siguiendo un nivel de `var()` y el `color-mix(… black)` del hover. */
function tokenValue(block: string, name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(block);
  expect(match, `falta --${name} en el bloque`).toBeTruthy();

  const raw = match![1].trim();

  const reference = /^var\(--([\w-]+)\)$/.exec(raw);
  if (reference) return tokenValue(block, reference[1]);

  const mixed = /^color-mix\(in srgb, var\(--([\w-]+)\) (\d+)%, black\)$/.exec(raw);
  if (mixed) {
    const base = tokenValue(block, mixed[1]);
    const ratio = Number(mixed[2]) / 100;
    const channels = [1, 3, 5].map((offset) =>
      Math.round(Number.parseInt(base.slice(offset, offset + 2), 16) * ratio),
    );
    return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  return raw;
}

const css = readRepoFile(GLOBALS_CSS);
const lightBlock = blockOf(css, ":root {");
const darkBlock = blockOf(css, ".dark {");

describe("contrato · modo oscuro y tokens (DESIGN_REFERENCES.md §3.10 y §4)", () => {
  it("el interruptor existe, con color-scheme para los controles nativos", () => {
    expect(darkBlock).toContain("color-scheme: dark");
  });

  it("los tokens del ADN existen en los dos modos", () => {
    const missing = REQUIRED_IN_BOTH_MODES.flatMap((name) => {
      const absent: string[] = [];
      if (!new RegExp(`--${name}:`).test(lightBlock)) absent.push(`${name} en :root`);
      if (!new RegExp(`--${name}:`).test(darkBlock)) absent.push(`${name} en .dark`);
      return absent;
    });

    expect(missing, "un token que solo vive en el modo claro rompe el oscuro").toEqual([]);
  });

  it("ningún par texto/fondo baja de 4.5:1, en light ni en dark", () => {
    const offenders: string[] = [];

    for (const [mode, block] of [
      ["light", lightBlock],
      ["dark", darkBlock],
    ] as const) {
      for (const [foreground, background] of CONTRAST_PAIRS) {
        const ratio = contrastRatio(tokenValue(block, foreground), tokenValue(block, background));

        if (ratio === null) {
          offenders.push(`${mode} · ${foreground} sobre ${background}: color inválido`);
        } else if (ratio < TEXT_CONTRAST_MIN) {
          offenders.push(
            `${mode} · ${foreground} sobre ${background}: ${ratio.toFixed(2)}:1 (mínimo ${TEXT_CONTRAST_MIN})`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("no vuelven los 16 tokens muertos que C1-3 eliminó", () => {
    const declared = FORBIDDEN_TOKENS.filter((name) =>
      new RegExp(`^\\s*${name}:`, "m").test(css),
    );

    expect(
      declared,
      "un token sin consumidor se borra del CSS en vez de quedar como superficie muerta",
    ).toEqual([]);
  });

  it("el ADN visual está versionado en la raíz", () => {
    expect(fileExists("DESIGN_REFERENCES.md")).toBe(true);
    expect(readRepoFile("DESIGN_REFERENCES.md")).toContain("fuente de verdad visual");
  });
});
