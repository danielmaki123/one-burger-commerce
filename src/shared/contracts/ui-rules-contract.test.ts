import { describe, expect, it } from "vitest";

import { fileExists, listFiles, readRepoFile } from "./contract-files";

/**
 * Capa 0 de `plan2uiux.md` — el contrato que sostiene los documentos y el registro.
 *
 * Lo que pide la validación de C0, y dónde se verifica cada cosa:
 *
 * 1. **Los 8 tokens del ADN están en `globals.css`** en los dos modos y **expuestos como utilidad**
 *    (`@theme inline`). Los dos primeros los mira también `dark-mode-contract.test.ts`; lo que agrega
 *    este archivo es el mapeo a utilidad, que es lo que hace que `bg-success-soft` exista.
 * 2. **El registro cubre todos los primitivos de `src/shared/ui/`** (ruta exacta, no solo el nombre) y
 *    **cada fila del registro está citada en el catálogo** de `DESIGN_SYSTEM.md` §3: así el espejo no
 *    se degrada por el lado del doc, que es el que `registry-contract.test.ts` no mira.
 * 3. **`AGENTS.md` no referencia documentos obsoletos** y **cada `§N` que cita existe** en el documento
 *    citado: es la clase de error que quedó viva durante semanas (`AGENTS.md` mandaba a un `§5` que no
 *    tenía la lista). Que las rutas citadas existan lo verifica `docs-sync-contract.test.ts`.
 * 4. **Los dos documentos respetan su tope**: `AGENTS.md` ≤300 líneas, `DESIGN_SYSTEM.md` ≤250.
 * 5. **Las reglas de producto quedaron escritas**: "Tarde" contra la hora prometida, "Cobrado hoy" como
 *    plata cobrada y los **5 estados** obligatorios por pantalla.
 * 6. **Las 20 reglas de C0-2b están**, cada una con qué, por qué y cómo verificar.
 * 7. **`DESIGN_REFERENCES.md` es el ADN**: 10 patrones, los 8 tokens y su checklist.
 * 8. **Los tres documentos obsoletos no volvieron** (C0-5).
 */

const AGENTS_DOC = "AGENTS.md";
const DESIGN_SYSTEM_DOC = "DESIGN_SYSTEM.md";
const DESIGN_REFERENCES_DOC = "DESIGN_REFERENCES.md";
const REGISTRY_PATH = "src/shared/ui/registry.json";
const GLOBALS_CSS = "src/app/globals.css";

/** Los 8 tokens que agregó el ADN (`DESIGN_REFERENCES.md` §4). */
const ADN_TOKENS = [
  "success-soft",
  "success-strong",
  "warning-soft",
  "warning-strong",
  "danger-soft",
  "danger-strong",
  "info-soft",
  "info-strong",
];

/** Docs que C0-5 borró: si reaparecen en el disco o en `AGENTS.md`, es una fuga. */
const OBSOLETE_DOCS = [
  "design/DESIGN.md",
  "design/DESIGN_SYSTEM.md",
  "docs/ui/admin-design-system.md",
];

/** La lista de copy decorativo tiene que estar en el doc al que apunta `AGENTS.md`. */
const REQUIRED_SECTIONS_IN_AGENTS = { [DESIGN_SYSTEM_DOC]: [2, 3, 5] };

/** Líneas de un archivo, sin contar el salto final. */
function lineCount(source: string): number {
  return source.replace(/\n$/, "").split("\n").length;
}

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

describe("contrato · Capa 0 (tokens, registro, documentos y las 20 reglas)", () => {
  it("los 8 tokens del ADN están en los dos modos y expuestos como utilidad", () => {
    const css = readRepoFile(GLOBALS_CSS);
    const light = blockOf(css, ":root {");
    const dark = blockOf(css, ".dark {");
    const theme = blockOf(css, "@theme inline {");

    const missing = ADN_TOKENS.flatMap((name) => {
      const absent: string[] = [];
      if (!new RegExp(`--${name}:`).test(light)) absent.push(`--${name} en :root`);
      if (!new RegExp(`--${name}:`).test(dark)) absent.push(`--${name} en .dark`);
      if (!new RegExp(`--color-${name}:\\s*var\\(--${name}\\)`).test(theme)) {
        absent.push(`--color-${name} en @theme (sin eso no existe la utilidad)`);
      }
      return absent;
    });

    expect(missing, "un token sin utilidad se declara y no se puede usar").toEqual([]);
  });

  it("el registro cubre todos los primitivos de src/shared/ui/ y el catálogo cita cada fila", () => {
    const registry = JSON.parse(readRepoFile(REGISTRY_PATH)) as {
      components: Array<{ name: string; file: string; layer: string }>;
    };

    const registeredFiles = new Set(registry.components.map((component) => component.file));

    const primitives = listFiles(
      "src/shared/ui",
      (repoPath) => /\.(ts|tsx)$/.test(repoPath) && !/\.test\.(ts|tsx)$/.test(repoPath),
    );

    expect(primitives.length).toBeGreaterThan(15);

    const unregistered = primitives.filter((repoPath) => !registeredFiles.has(repoPath));
    expect(unregistered, "registralos en src/shared/ui/registry.json").toEqual([]);

    // El otro lado del espejo: la fila tiene que estar en el catálogo humano.
    const designSystem = readRepoFile(DESIGN_SYSTEM_DOC);
    const notInCatalog = registry.components
      .filter((component) => component.layer === "shared")
      .filter((component) => !designSystem.includes(component.file.split("/").pop()!))
      .map((component) => component.name);

    expect(notInCatalog, "una fila del registro que el catálogo no cita es una fila invisible").toEqual(
      [],
    );
  });

  it("AGENTS.md cita secciones que existen y no menciona documentos obsoletos", () => {
    const agents = readRepoFile(AGENTS_DOC);

    const brokenSections: string[] = [];

    for (const [doc, sections] of Object.entries(REQUIRED_SECTIONS_IN_AGENTS)) {
      const target = readRepoFile(doc);

      for (const section of sections) {
        const cited = new RegExp(`${doc.replace(".", "\\.")}\\s*§${section}\\b`).test(agents);
        const exists = new RegExp(`^#{2,3} ${section}\\.`, "m").test(target);

        if (cited && !exists) brokenSections.push(`${doc} §${section}`);
      }
    }

    expect(brokenSections, "un puntero a una sección que no existe manda al próximo agente al vacío").toEqual(
      [],
    );

    const citedObsolete = OBSOLETE_DOCS.filter((repoPath) => agents.includes(repoPath));
    expect(citedObsolete, "AGENTS.md no cita documentos obsoletos").toEqual([]);
  });

  it("los documentos respetan su tope de tamaño y los obsoletos siguen borrados", () => {
    expect(lineCount(readRepoFile(AGENTS_DOC)), "AGENTS.md ≤ 300 líneas").toBeLessThanOrEqual(300);
    expect(
      lineCount(readRepoFile(DESIGN_SYSTEM_DOC)),
      "DESIGN_SYSTEM.md ≤ 250 líneas",
    ).toBeLessThanOrEqual(250);

    const alive = OBSOLETE_DOCS.filter((repoPath) => fileExists(repoPath));
    expect(alive, "C0-5 los borró: un doc viejo que vuelve describe un sistema que ya no existe").toEqual(
      [],
    );
  });

  it("las reglas de producto y los 5 estados están escritos en el catálogo", () => {
    const designSystem = readRepoFile(DESIGN_SYSTEM_DOC);

    // "Tarde" contra la hora prometida de retiro; nunca desde createdAt.
    expect(designSystem, 'la regla de "Tarde" tiene que nombrar la hora prometida').toMatch(
      /Tarde[\s\S]{0,200}hora prometida/,
    );
    expect(designSystem).toMatch(/pickupTime/);
    expect(designSystem, '"Tarde" no se calcula desde createdAt').toMatch(/No cuenta desde `createdAt`/);

    // "Cobrado hoy" = plata cobrada.
    expect(designSystem).toMatch(/Cobrado hoy[\s\S]{0,120}Payment/);
    expect(designSystem).toMatch(/completedOrderValue/);
    expect(designSystem, "si el backend no tiene el dato, el copy no miente").toMatch(
      /Pedidos completados/,
    );

    // Los 5 estados obligatorios por pantalla.
    for (const state of ["con datos", "cargando", "vacío", "error", "nada pendiente"]) {
      expect(designSystem, `falta el estado "${state}" en los 5 estados obligatorios`).toContain(state);
    }
  });

  it("las 20 reglas están, cada una con qué, por qué y cómo verificar", () => {
    const designSystem = readRepoFile(DESIGN_SYSTEM_DOC);
    const rows = [...designSystem.matchAll(/^\| (R\d+) \| (.+?) \|$/gm)];

    expect(rows.length, "C0-2b pide 20 reglas").toBe(20);

    // Cada fila es `| # | Grupo | Qué | Por qué | Cómo verificar |`: las tres últimas celdas tienen
    // que explicar algo por sí solas (una regla sin por qué no se puede cumplir ni auditar).
    const thin = rows
      .filter(([, , row]) => {
        const cells = row.split("|").map((cell) => cell.trim());
        return cells.length !== 4 || cells.slice(1).some((cell) => cell.length < 20);
      })
      .map(([, id]) => id);

    expect(thin, "una regla sin por qué ni cómo verificar no se puede cumplir ni auditar").toEqual([]);

    const ids = rows.map(([, id]) => id);
    expect(new Set(ids).size, "una regla repetida ocupa el lugar de otra").toBe(20);
  });

  it("DESIGN_REFERENCES.md es el ADN: 10 patrones, los 8 tokens y su checklist", () => {
    const references = readRepoFile(DESIGN_REFERENCES_DOC);

    const patterns = [...references.matchAll(/^### Patrón (\d+)/gm)].map(([, number]) => Number(number));
    expect(patterns, "los 10 patrones del ADN").toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    const missingTokens = ADN_TOKENS.filter((name) => !references.includes(`--${name}`));
    expect(missingTokens, "los 8 tokens nuevos tienen que estar documentados").toEqual([]);

    const checklist = references.match(/### Al terminar UI([\s\S]*?)(?=\n###|\n---)/);
    expect(checklist, "falta el checklist antes de terminar UI").toBeTruthy();
    expect((checklist![1].match(/^- \[ \]/gm) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
