import { describe, expect, it } from "vitest";

import { fileExists, listFiles, readRepoFile } from "./contract-files";

/**
 * Sistema de diseño oficial (2026-09-16) — el contrato que lo sostiene.
 *
 * Reemplaza a `ui-rules-contract.test.ts`, que custodiaba los documentos viejos
 * (`DESIGN_REFERENCES.md` / `DESIGN_SYSTEM.md`) que el owner mandó borrar cuando declaró a
 * `ops/references/stitch/design-system.md` como **la** fuente de verdad visual. Lo que se conserva
 * es el espíritu: que el sistema esté, que sus tokens lleguen al CSS, que el panel sea el que dice
 * y que lo viejo no vuelva.
 *
 * Lo que garantiza:
 *
 * 1. **El sistema está**: el documento oficial y las **7 pantallas** de referencia (cada una con su
 *    `code.html` y su `screen.png`).
 * 2. **Lo viejo no vuelve**: los documentos deprecados y el mockup HTML anterior no están, y `src/`
 *    no los cita.
 * 3. **`AGENTS.md` apunta al sistema nuevo** y cada `§N` que cita existe en el documento (es la
 *    clase de error que quedó viva semanas con el sistema anterior).
 * 4. **Los tokens del sistema están en `globals.css`**: los nombres oficiales, la capa de estados
 *    operativos, los radios, las elevaciones y la tipografía mono.
 * 5. **El modo oscuro es del PANEL**: el shell del admin lleva `class="dark"` y el layout raíz (que
 *    envuelve también al público) **no**, que es la decisión del owner del 2026-09-16.
 * 6. **JetBrains Mono se carga de verdad** (la pide el sistema para todos los números).
 *
 * El contraste de los pares y el borde de control viven en `dark-mode-contract.test.ts`, que mide.
 */

const DESIGN_SYSTEM_DOC = "ops/references/stitch/design-system.md";
const STITCH_DIR = "ops/references/stitch/stitch_redise_o_de_secci_n_existente";
const AGENTS_DOC = "AGENTS.md";
const GLOBALS_CSS = "src/app/globals.css";
const ADMIN_SHELL = "src/app/(admin)/admin/_components/admin-shell.tsx";
const ROOT_LAYOUT = "src/app/layout.tsx";

/** Las 7 pantallas del roadmap, en el orden en que se implementan. */
const SCREENS = [
  "one_burger_comandas_en_vivo_kds_activo",
  "one_burger_punto_de_venta_pos",
  "one_burger_resumen_operativo",
  "one_burger_gesti_n_del_men",
  "one_burger_locales_y_horarios",
  "one_burger_usuarios_y_roles",
  "one_burger_marca_y_personalizaci_n",
];

/** Documentos y artefactos que el sistema nuevo reemplazó: si vuelven, es una fuga. */
const OBSOLETE = [
  "DESIGN_REFERENCES.md",
  "DESIGN_SYSTEM.md",
  "design/DESIGN.md",
  "design/DESIGN_SYSTEM.md",
  "docs/ui/admin-design-system.md",
  "ops/tasks/audit-ui/mockup-admin-inicio.html",
];

/** Nombres oficiales de los tokens del sistema (`design-system.md` §1 y §4). */
const SYSTEM_TOKENS = [
  "--bg-canvas",
  "--bg-surface",
  "--bg-surface-low",
  "--bg-surface-card",
  "--bg-surface-elevated",
  "--bg-surface-input",
  "--border-subtle",
  "--border-medium",
  "--border-strong",
  "--border-control",
  "--border-focus",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--text-inverse",
  "--brand-primary",
  "--brand-primary-hover",
  "--brand-amber",
  "--brand-amber-hover",
  "--brand-yellow",
];

/** La capa de estados operativos (§1.4): cuatro estados × cuatro piezas. */
const STATUS_TOKENS = ["pending", "prep", "ready", "sla"].flatMap((state) =>
  ["bg", "border", "text"].map((part) => `--status-${state}-${part}`),
);

/** Líneas de un archivo, sin contar el salto final. */
function lineCount(source: string): number {
  return source.replace(/\n$/, "").split("\n").length;
}

/** El cuerpo de un bloque `selector { … }` contando llaves anidadas. */
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

describe("contrato · sistema de diseño Stitch", () => {
  it("el documento oficial y las 7 pantallas de referencia existen", () => {
    expect(fileExists(DESIGN_SYSTEM_DOC), `falta ${DESIGN_SYSTEM_DOC}`).toBe(true);

    const missing = SCREENS.flatMap((screen) => {
      const base = `${STITCH_DIR}/${screen}`;
      return [`${base}/code.html`, `${base}/screen.png`].filter((file) => !fileExists(file));
    });

    expect(missing, "cada pantalla trae su HTML y su captura: sin eso no hay referencia visual").toEqual(
      [],
    );
  });

  it("los documentos deprecados no vuelven y src/ no los cita", () => {
    const alive = OBSOLETE.filter((repoPath) => fileExists(repoPath));
    expect(alive, "el sistema nuevo los reemplaza: recrearlos deja dos fuentes de verdad").toEqual([]);

    const cited = listFiles(
      "src",
      (repoPath) => /\.(ts|tsx|css)$/.test(repoPath) && !/\.test\./.test(repoPath),
    ).filter((repoPath) => /DESIGN_REFERENCES|DESIGN_SYSTEM\.md/.test(readRepoFile(repoPath)));

    expect(cited, "el código no puede seguir apuntando a los documentos borrados").toEqual([]);
  });

  it("AGENTS.md apunta al sistema y cada § que cita existe", () => {
    const agents = readRepoFile(AGENTS_DOC);

    expect(agents, "AGENTS.md tiene que nombrar el sistema oficial").toContain(DESIGN_SYSTEM_DOC);
    expect(
      lineCount(agents),
      "AGENTS.md ≤ 300 líneas: es el archivo que todo agente lee primero",
    ).toBeLessThanOrEqual(300);

    // Nombra los documentos viejos una vez, para decir que se borraron: lo que no puede es citarlos
    // como fuente ni mandar a sus secciones.
    expect(agents, "no puede enlazarlos").not.toMatch(/\]\(DESIGN_(?:REFERENCES|SYSTEM)\.md\)/);
    expect(agents, "ni citar sus secciones").not.toMatch(/`DESIGN_(?:REFERENCES|SYSTEM)\.md`\s*§/);

    const designSystem = readRepoFile(DESIGN_SYSTEM_DOC);
    const cited = [...agents.matchAll(/design-system\.md`?\s*§(\d)/g)].map((match) => match[1]);

    expect(cited.length, "el archivo tiene que citar las secciones del sistema").toBeGreaterThan(0);

    const broken = cited.filter((section) => !new RegExp(`^## ${section}\\.`, "m").test(designSystem));
    expect(broken, "un puntero a una sección que no existe manda al próximo agente al vacío").toEqual([]);
  });

  it("globals.css declara los tokens del sistema, los estados y las utilidades", () => {
    const css = readRepoFile(GLOBALS_CSS);
    const light = blockOf(css, ":root {");
    const dark = blockOf(css, ".dark {");
    const theme = css.slice(css.indexOf("@theme inline {"));

    const missing = [...SYSTEM_TOKENS, ...STATUS_TOKENS].flatMap((name) => {
      const absent: string[] = [];
      if (!new RegExp(`${name}:`).test(light)) absent.push(`${name} en :root`);
      if (!new RegExp(`${name}:`).test(dark)) absent.push(`${name} en .dark`);
      return absent;
    });

    expect(missing, "un token del sistema que solo vive en un modo rompe el otro").toEqual([]);

    // Las utilidades: sin el mapeo en `@theme`, el token existe y no se puede usar como clase.
    const utilities = [
      "--color-surface-card: var(--bg-surface-card)",
      "--color-line-control: var(--border-control)",
      "--color-ink-muted: var(--text-muted)",
      "--color-brand-amber: var(--brand-amber)",
      "--color-status-prep-text: var(--status-prep-text)",
      "--color-status-sla-bg: var(--status-sla-bg)",
    ];
    const unusable = utilities.filter((entry) => !theme.includes(entry));
    expect(unusable, "un token sin utilidad se declara y no se puede usar").toEqual([]);

    for (const token of ["--radius-stitch-md", "--radius-stitch-lg", "--radius-stitch-xl"]) {
      expect(theme, `falta ${token} (§4)`).toContain(`${token}:`);
    }

    for (const token of ["--shadow-elevation-2", "--shadow-glow-amber", "--shadow-glow-critical"]) {
      expect(theme, `falta ${token} (§5)`).toContain(`${token}:`);
    }

    // La escala del panel (§2.2), con sus ocho niveles.
    for (const level of ["display", "h1", "h2", "h3", "body-lg", "body", "caption", "overline"]) {
      expect(theme, `falta --text-st-${level} (§2.2)`).toContain(`--text-st-${level}:`);
    }
  });

  it("el modo oscuro es del panel, no del sitio público", () => {
    const shell = readRepoFile(ADMIN_SHELL);
    expect(shell, "el shell del panel activa el modo oscuro").toMatch(/className="dark[ "]/);

    const root = readRepoFile(ROOT_LAYOUT);
    // El layout raíz envuelve a `(admin)`, `(public)` y `(landing)`: si `dark` estuviera ahí, el
    // menú y el checkout del cliente se verían oscuros, y el owner decidió que el público no cambia.
    expect(root, "el `dark` global oscurecería el público").not.toMatch(/className=\{?["'`]dark/);
  });

  it("JetBrains Mono llega al navegador como `font-mono`", () => {
    const root = readRepoFile(ROOT_LAYOUT);
    expect(root, "la fuente de números del sistema se carga en el layout raíz").toMatch(
      /JetBrains_Mono/,
    );
    expect(root, "su variable tiene que aplicarse al documento").toContain("jetbrainsMono.variable");

    const theme = readRepoFile(GLOBALS_CSS);
    expect(theme, "el tema mapea la mono del sistema").toMatch(
      /--font-mono:\s*var\(--font-jetbrains\)/,
    );
  });
});
