import { describe, expect, it } from "vitest";

import { countLines, countMatches, fileExists, listFiles, readRepoFile } from "./contract-files";
import {
  DESIGN_GUARDRAIL_TOKEN_SOURCE,
  measureDesignGuardrails,
} from "./design-guardrails";

/**
 * Ley visual (2026-09-25, `DS-001`) — el contrato que la sostiene.
 *
 * Reemplaza a `stitch-system-contract.test.ts`, que custodiaba el sistema de **Stitch** adoptado en
 * 2026-09-16. Lo que se conserva es el espíritu —que la ley esté, que sus tokens lleguen al CSS, que el
 * panel sea oscuro, que los documentos viejos no vuelvan y que `AGENTS.md` siga corto— y lo que cambia es
 * **de quién es la ley**: ahora es del repo (`ops/design/`), no de un documento de terceros.
 *
 * Qué garantiza:
 *
 * 1. **La ley está y es única**: existen los seis documentos de `ops/design/`, y **un solo** documento del
 *    repo se proclama fuente de la ley visual.
 * 2. **Nadie más la exige**: el registro de componentes, las skills de UI y `AGENTS.md` apuntan al Design
 *    System v4; el material de Stitch está **archivado** y ninguna instrucción activa manda a su `code.html`.
 * 3. **Los documentos viejos no vuelven** (los que el sistema anterior reemplazó) y `src/` no los cita.
 * 4. **Los tokens están en `globals.css`**, en los dos modos y con utilidad de Tailwind: estructura, marca,
 *    estados, datos y motion.
 * 5. **El modo oscuro es del PANEL** (shell del admin) y el público sigue claro.
 * 6. **Accesibilidad medida**: contraste y borde de control viven en `dark-mode-contract.test.ts`;
 *    acá se custodia el **movimiento reducido** y dos pisos de deuda (tipografía numérica y `motion-reduce`).
 *
 * **No se automatiza** "se ve premium", "el texto explica demasiado" ni "esa Card estaba de más": eso lo
 * resuelve el criterio, con la ley delante.
 */

const DESIGN_SYSTEM_DOC = "ops/design/DESIGN_SYSTEM.md";
const DESIGN_DIR = "ops/design";
const AUX_DOCS = ["README.md", "CONTENT.md", "PATTERNS.md", "MOTION.md", "DATA_VISUALIZATION.md"];
const SCREEN_TEMPLATE = "ops/design/screens/TEMPLATE.md";
const SKILLS_WITH_UI_LAW = ["ui-change", "screen-design"];
const REGISTRY_PATH = "src/shared/ui/registry.json";
const ARCHIVED_STITCH_DIR = "ops/references/stitch";
const AGENTS_DOC = "AGENTS.md";
const GLOBALS_CSS = "src/app/globals.css";
const ADMIN_SHELL = "src/app/(admin)/admin/_components/admin-shell.tsx";
const ROOT_LAYOUT = "src/app/layout.tsx";

/** La frase con la que un documento se proclama ley visual: solo puede estar en el canónico. */
const VISUAL_AUTHORITY_CLAIM = "fuente de la ley visual";

/** Documentos y artefactos que el sistema nuevo reemplazó: si vuelven, es una fuga. */
const OBSOLETE = [
  "DESIGN_REFERENCES.md",
  "DESIGN_SYSTEM.md",
  "design/DESIGN.md",
  "design/DESIGN_SYSTEM.md",
  "docs/ui/admin-design-system.md",
  "ops/tasks/audit-ui/mockup-admin-inicio.html",
];

/** Nombres canónicos de la estructura y la marca (los del sistema, que sobrevivieron a Stitch). */
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

/** La capa de estados operativos: cuatro estados × tres piezas. */
const STATUS_TOKENS = ["pending", "prep", "ready", "sla"].flatMap((state) =>
  ["bg", "border", "text"].map((part) => `--status-${state}-${part}`),
);

/** Datos: el vocabulario semántico de los gráficos (alias de `--chart-N`, mismo valor). */
const CHART_TOKENS = [
  "--chart-primary",
  "--chart-secondary",
  "--chart-tertiary",
  "--chart-muted",
  "--chart-positive",
  "--chart-negative",
];

/** Motion: la escala de `ops/design/MOTION.md`. */
const MOTION_TOKENS = [
  "--motion-fast",
  "--motion-standard",
  "--motion-emphasized",
  "--motion-ease-standard",
  "--motion-ease-emphasized",
];

/**
 * Pisos de deuda (no techos): la deuda visual **baja** cuando su sección se migra, pero una caída brusca
 * de estas dos reglas significa que se perdió una propiedad del sistema, no que se limpió deuda.
 */
const NUMERIC_TYPOGRAPHY_FLOOR = 100; // `tabular-nums` medido el 2026-09-25: 174
const MOTION_REDUCE_FLOOR = 40; // `motion-reduce:` medido el 2026-09-25: 47

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

describe("contrato · ley visual (Design System v4)", () => {
  it("existen la ley y sus documentos auxiliares", () => {
    const missing = [DESIGN_SYSTEM_DOC, SCREEN_TEMPLATE, ...AUX_DOCS.map((doc) => `${DESIGN_DIR}/${doc}`)]
      .filter((repoPath) => !fileExists(repoPath));

    expect(
      missing,
      "la ley visual se escribe una vez y se reparte en documentos chicos: sin una pieza, el agente improvisa",
    ).toEqual([]);
  });

  it("una sola fuente se proclama ley visual", () => {
    /**
     * Propiedad objetiva: **una sola declaración de autoridad**. Un documento que se proclame fuente de la
     * ley visual tiene que ser el canónico; si aparece un segundo, este contrato lo delata antes de que dos
     * documentos se contradigan en silencio. La historia archivada queda afuera a propósito.
     */
    const normativeDocs = [
      ...listFiles("ops", (repoPath) => repoPath.endsWith(".md") && !repoPath.startsWith("ops/history/")),
      ...listFiles(".agents", (repoPath) => repoPath.endsWith(".md")),
      "AGENTS.md",
      "CLAUDE.md",
    ];

    const claimants = normativeDocs
      .filter((repoPath) => readRepoFile(repoPath).includes(VISUAL_AUTHORITY_CLAIM))
      .sort();

    expect(
      claimants,
      "dos documentos no pueden proclamarse dueños de la ley visual: se escribe una vez y se enlaza",
    ).toEqual([DESIGN_SYSTEM_DOC]);
  });

  it("el registro, las skills y AGENTS.md apuntan a la ley", () => {
    const registry = readRepoFile(REGISTRY_PATH);
    expect(registry, "el registro de componentes declara su fuente").toContain(
      `"source_of_truth": "${DESIGN_SYSTEM_DOC}"`,
    );
    expect(registry, "y su catálogo").toContain(`"catalog": "${DESIGN_SYSTEM_DOC}"`);

    const skillsWithoutLaw = SKILLS_WITH_UI_LAW.map((skill) => `.agents/skills/${skill}/SKILL.md`)
      .filter((repoPath) => !readRepoFile(repoPath).includes(DESIGN_SYSTEM_DOC));

    expect(
      skillsWithoutLaw,
      "una skill que toca UI tiene que leer la ley del repo, no improvisarla",
    ).toEqual([]);

    const agents = readRepoFile(AGENTS_DOC);
    expect(agents, "AGENTS.md tiene que nombrar la ley").toContain(DESIGN_SYSTEM_DOC);
    expect(
      countLines(AGENTS_DOC),
      "AGENTS.md ≤ 300 líneas: es el archivo que todo agente lee primero",
    ).toBeLessThanOrEqual(300);
    expect(agents, "no puede enlazar el material archivado como sistema").not.toContain(
      `](${ARCHIVED_STITCH_DIR}/design-system.md)`,
    );
    expect(agents, "ni citar documentos borrados").not.toMatch(
      /\]\(DESIGN_(?:REFERENCES|SYSTEM)\.md\)/,
    );

    // Cada `§N` que AGENTS.md cita **en el párrafo donde nombra la ley** tiene que existir: es la clase de
    // error que quedó viva semanas con el sistema anterior (un puntero a una sección que ya no está).
    const designSystem = readRepoFile(DESIGN_SYSTEM_DOC);
    const paragraphsWithLaw = agents
      .split(/\n\s*\n/)
      .filter((paragraph) => paragraph.includes(DESIGN_SYSTEM_DOC))
      .join("\n\n");
    const cited = [...paragraphsWithLaw.matchAll(/§(\d+)/g)].map((match) => match[1]);

    expect(cited.length, "AGENTS.md tiene que citar las secciones de la ley").toBeGreaterThan(0);

    const broken = cited.filter((section) => !new RegExp(`^## ${section}\\.`, "m").test(designSystem));
    expect(broken, "un puntero a una sección que no existe manda al próximo agente al vacío").toEqual([]);
  });

  it("Stitch quedó archivado y ninguna instrucción activa lo exige", () => {
    const archiveIndex = `${ARCHIVED_STITCH_DIR}/README.md`;
    expect(fileExists(archiveIndex), "el archivo histórico no se borra").toBe(true);

    const index = readRepoFile(archiveIndex);
    expect(index, "el índice del archivo tiene que decirlo").toContain("ARCHIVED");
    expect(index, "y que no es normativo").toContain("NON-NORMATIVE");
    expect(
      readRepoFile(DESIGN_SYSTEM_DOC),
      "la ley tiene que declarar que el material anterior quedó archivado",
    ).toContain("ARCHIVED / NON-NORMATIVE");

    const skill = readRepoFile(".agents/skills/ui-change/SKILL.md");
    expect(skill, "la skill de UI ya no traduce el HTML de Stitch").not.toContain("code.html");
    expect(skill, "ni exige su captura").not.toContain("screen.png");
  });

  it("los documentos que el sistema reemplazó no vuelven y src/ no los cita", () => {
    const alive = OBSOLETE.filter((repoPath) => fileExists(repoPath));
    expect(alive, "el sistema nuevo los reemplaza: recrearlos deja dos fuentes de verdad").toEqual([]);

    const cited = listFiles(
      "src",
      (repoPath) => /\.(ts|tsx|css)$/.test(repoPath) && !/\.test\./.test(repoPath),
    ).filter((repoPath) =>
      // El `DESIGN_SYSTEM.md` que no puede volver es el **de la raíz** (y `DESIGN_REFERENCES.md`). Un
      // documento con ruta (`ops/design/DESIGN_SYSTEM.md`) es la ley vigente y citarla está bien.
      /DESIGN_REFERENCES\.md|(?<![\w/-])DESIGN_SYSTEM\.md/.test(readRepoFile(repoPath)),
    );

    expect(cited, "el código no puede seguir apuntando a los documentos borrados").toEqual([]);
  });

  it("globals.css declara los tokens del sistema, los estados, los datos y el motion", () => {
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

    const missingData = [...CHART_TOKENS, ...MOTION_TOKENS].filter(
      (name) => !new RegExp(`${name}:`).test(light),
    );
    expect(missingData, "los tokens nuevos (datos y motion) viven en :root").toEqual([]);

    // Las series de gráfico siguen resolviéndose por modo: el modo oscuro reescribe la paleta base.
    expect(dark, "el panel define su propia paleta de datos (§1.2 del archivo histórico)").toMatch(
      /--chart-1:/,
    );

    // Las utilidades: sin el mapeo en `@theme`, el token existe y no se puede usar como clase.
    const utilities = [
      "--color-surface-card: var(--bg-surface-card)",
      "--color-line-control: var(--border-control)",
      "--color-ink-muted: var(--text-muted)",
      "--color-brand-amber: var(--brand-amber)",
      "--color-status-prep-text: var(--status-prep-text)",
      "--color-chart-primary: var(--chart-primary)",
      "--color-chart-negative: var(--chart-negative)",
    ];
    const unusable = utilities.filter((entry) => !theme.includes(entry));
    expect(unusable, "un token sin utilidad se declara y no se puede usar").toEqual([]);

    for (const token of ["--radius-stitch-md", "--radius-stitch-lg", "--radius-stitch-xl"]) {
      expect(theme, `falta ${token} (radios del panel)`).toContain(`${token}:`);
    }

    for (const token of ["--shadow-elevation-2", "--shadow-glow-amber", "--shadow-glow-critical"]) {
      expect(theme, `falta ${token} (elevaciones del panel)`).toContain(`${token}:`);
    }

    for (const level of ["display", "h1", "h2", "h3", "body-lg", "body", "caption", "overline"]) {
      expect(theme, `falta --text-st-${level} (escala del panel)`).toContain(`--text-st-${level}:`);
    }
  });

  it("el movimiento reducido está contemplado una sola vez y no se pierde", () => {
    const css = readRepoFile(GLOBALS_CSS);

    expect(
      css,
      "la media query global es la que cubre todo lo que se escriba en el futuro",
    ).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css, "y neutraliza las duraciones en vez de solo documentarlo").toMatch(
      /transition-duration:\s*0?\.01ms/,
    );

    const motionDoc = readRepoFile("ops/design/MOTION.md");
    expect(motionDoc, "MOTION.md explica la regla, no solo la nombra").toContain(
      "prefers-reduced-motion",
    );
    expect(motionDoc, "y los tres pasos de la escala").toContain("--motion-fast");

    const withMotionReduce = countMatches(
      listFiles("src", (repoPath) => /\.(ts|tsx)$/.test(repoPath) && !/\.test\./.test(repoPath))
        .map((repoPath) => readRepoFile(repoPath))
        .join("\n"),
      /motion-reduce:/g,
    );

    expect(
      withMotionReduce,
      `las variantes motion-reduce no pueden caer por debajo del piso (${MOTION_REDUCE_FLOOR}): son la defensa por componente`,
    ).toBeGreaterThanOrEqual(MOTION_REDUCE_FLOOR);
  });

  it("la tipografía numérica del sistema no se pierde", () => {
    const sources = listFiles("src", (repoPath) => /\.(ts|tsx)$/.test(repoPath) && !/\.test\./.test(repoPath))
      .map((repoPath) => readRepoFile(repoPath))
      .join("\n");

    expect(
      countMatches(sources, /tabular-nums/g),
      `los números del sistema (plata, cronómetros, IDs, contadores) son tabulares: el piso es ${NUMERIC_TYPOGRAPHY_FLOOR}`,
    ).toBeGreaterThanOrEqual(NUMERIC_TYPOGRAPHY_FLOOR);

    expect(
      readRepoFile(DESIGN_SYSTEM_DOC),
      "y la ley tiene que seguir exigiéndolo",
    ).toContain("tabular-nums");
  });

  it("el vocabulario canónico es neutral: la nomenclatura histórica queda como alias", () => {
    const css = readRepoFile(GLOBALS_CSS);
    const light = blockOf(css, ":root {");
    const theme = css.slice(css.indexOf("@theme inline {"));

    // Marca: se pide por **intención**; el nombre del color queda como alias del mismo valor.
    expect(light, "`brand-accent` es la intención secundaria y resuelve al color del tema").toMatch(
      /--brand-accent:\s*var\(--brand-amber\)/,
    );
    expect(theme, "y tiene utilidad de Tailwind").toContain(
      "--color-brand-accent: var(--brand-accent)",
    );

    // Tipografía del panel: nombres neutrales como alias de la escala histórica (mismo valor, sin migración).
    for (const level of [
      "display",
      "title",
      "section",
      "item",
      "body",
      "body-lg",
      "meta",
      "overline",
    ]) {
      expect(theme, `falta --text-panel-${level} (vocabulario neutral del panel)`).toContain(
        `--text-panel-${level}: var(--text-st-`,
      );
    }

    const law = readRepoFile(DESIGN_SYSTEM_DOC);
    expect(law, "la ley recomienda el vocabulario neutral").toContain("text-panel-");
    expect(law, "y marca la nomenclatura histórica como tal").toContain("nomenclatura histórica");
  });

  it("el ratchet de color crudo existe y no mide donde el color es el dato", () => {
    const rawColorViolations = measureDesignGuardrails().filter(
      (violation) => violation.rule === "raw-color-function",
    );

    expect(
      rawColorViolations.length,
      "la regla de color crudo tiene que existir y tener su línea base medida",
    ).toBeGreaterThan(0);

    expect(
      rawColorViolations.map((violation) => violation.path),
      "la fuente de tokens (donde el color se declara) no es deuda",
    ).not.toContain(DESIGN_GUARDRAIL_TOKEN_SOURCE);

    expect(
      rawColorViolations.filter((violation) => violation.path.includes("business-settings")),
      "los presets y el contraste del negocio tampoco: ahí el color es el dato",
    ).toEqual([]);
  });

  it("el modo oscuro es del panel, no del sitio público", () => {
    const shell = readRepoFile(ADMIN_SHELL);
    expect(shell, "el shell del panel activa el modo oscuro").toMatch(/className="dark[ "]/);

    const root = readRepoFile(ROOT_LAYOUT);
    // El layout raíz envuelve a `(admin)`, `(public)` y `(landing)`: si `dark` estuviera ahí, el menú y el
    // checkout del cliente se verían oscuros, y el owner decidió que el público no cambia.
    expect(root, "el `dark` global oscurecería el público").not.toMatch(/className=\{?["'`]dark/);
  });

  it("JetBrains Mono llega al navegador como `font-mono`", () => {
    const root = readRepoFile(ROOT_LAYOUT);
    expect(root, "la fuente de números del sistema se carga en el layout raíz").toMatch(/JetBrains_Mono/);
    expect(root, "su variable tiene que aplicarse al documento").toContain("jetbrainsMono.variable");

    expect(readRepoFile(GLOBALS_CSS), "el tema mapea la mono del sistema").toMatch(
      /--font-mono:\s*var\(--font-jetbrains\)/,
    );
  });
});
