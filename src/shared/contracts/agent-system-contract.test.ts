import { describe, expect, it } from "vitest";

import { countLines, fileExists, readRepoFile } from "./contract-files";

/**
 * TASK-AUD-000 — contrato del sistema operativo de ingeniería del agente.
 *
 * La decisión y el «qué va dónde» están en
 * `ops/decisions/ADR-000-agent-operating-system.md`; el índice corto, en `.agents/README.md`.
 *
 * Este guardrail protege **estructura y relaciones**, no redacción: que los cuatro documentos
 * conceptuales existan (comportamiento · contexto · memoria · procedimientos), que el estado actual y
 * la historia estén separados, que las referencias cruzadas no se caigan, y que ninguno de los
 * archivos vuelva a convertirse en el diario de 3.000 líneas que motivó la reorganización.
 *
 * **Rutas citadas**: que un documento no apunte al vacío lo verifica
 * `docs-sync-contract.test.ts`, que es una sola implementación para todos los documentos del repo.
 *
 * Los techos de tamaño de acá son el mismo principio que el resto del repo (`AGENTS.md` →
 * *Ratcheting de calidad*): **solo se mantienen o bajan**. Si un documento se acerca al techo, la
 * discusión es qué se mueve a otro lado, no subir el número.
 */

/** Los cuatro documentos conceptuales + el estado operativo + el trabajo planificado. */
const REQUIRED_DOCUMENTS = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/README.md",
  ".agents/CONTEXT.md",
  ".agents/MEMORY.md",
  "ops/CURRENT.md",
] as const;

/** El procedimiento por tipo de trabajo. Las cuatro separaciones conceptuales dependen de que estén. */
const REQUIRED_SKILLS = [
  "new-task",
  "bugfix",
  "money-change",
  "database-migration",
  "security-change",
  "ui-change",
  "audit",
  "production-release",
] as const;

const REQUIRED_TASK_DOCUMENTS = [
  "ops/tasks/START-HERE.md",
  "ops/tasks/TEMPLATE.md",
  "ops/tasks/AUDIT-REMEDIATION-ROADMAP.md",
] as const;

/** El archivo del que salió esta reorganización. No se borra: se archiva. */
const LEGACY_STATE_DOCUMENT = "ops/history/project-state-legacy-2026-09.md";

/**
 * Techos de tamaño. Son deliberadamente holgados: no buscan el número justo, buscan que ningún archivo
 * vuelva a mezclar todas las responsabilidades.
 *
 * **`AGENTS.md` no está acá a propósito**: su techo (≤ 300 líneas, porque es el archivo que todo agente
 * lee primero) ya lo custodia `stitch-system-contract.test.ts`. Repetir el número sería crear una segunda
 * fuente de verdad para la misma regla — justo lo que `AGENTS.md` prohíbe.
 */
const MAX_LINES = {
  ".agents/CONTEXT.md": 400,
  ".agents/MEMORY.md": 400,
  "ops/CURRENT.md": 250,
  "CLAUDE.md": 40,
  // El puntero de compatibilidad: si crece, es que alguien volvió a escribir estado adentro.
  "ops/project-state.md": 60,
} as const;

/** Cuántas líneas de un documento son un espacio en blanco o un encabezado. */
function isSubstantive(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith("#");
}

describe("contrato · sistema operativo de ingeniería del agente", () => {
  it("existen los documentos conceptuales (comportamiento, contexto, memoria y estado)", () => {
    const missing = REQUIRED_DOCUMENTS.filter((doc) => !fileExists(doc));

    expect(
      missing,
      "falta un documento del sistema: sin las cuatro separaciones (AGENTS = reglas, CONTEXT = contexto, MEMORY = memoria, skills = procedimientos) el agente vuelve a improvisar",
    ).toEqual([]);
  });

  it("existen las skills obligatorias y no son placeholders", () => {
    const problems: string[] = [];

    for (const skill of REQUIRED_SKILLS) {
      const path = `.agents/skills/${skill}/SKILL.md`;

      if (!fileExists(path)) {
        problems.push(`${path}: falta`);
        continue;
      }

      const source = readRepoFile(path);
      const sections = (source.match(/^## /gm) ?? []).length;

      // Un archivo con un título y nada más "existe" pero no sirve: cada skill tiene que decir cuándo
      // se activa, el procedimiento y las prohibiciones.
      if (sections < 2 || source.split("\n").filter(isSubstantive).length < 15) {
        problems.push(`${path}: es un placeholder (secciones: ${sections})`);
      }
    }

    expect(
      problems,
      "una skill vacía es peor que no tenerla: promete un procedimiento que no existe",
    ).toEqual([]);
  });

  it("existen la plantilla de TASK, el roadmap, el ADR y el arranque de sesión", () => {
    const missing = [
      ...REQUIRED_TASK_DOCUMENTS,
      "ops/decisions/ADR-000-agent-operating-system.md",
    ].filter((doc) => !fileExists(doc));

    expect(missing, "falta trabajo planificado o su decisión").toEqual([]);
  });

  it("AGENTS.md referencia contexto, memoria, estado, plantilla, skills, design system y runbook", () => {
    const agents = readRepoFile("AGENTS.md");

    const expected: Array<[string, string]> = [
      [".agents/CONTEXT.md", "cómo está construido el sistema"],
      [".agents/MEMORY.md", "el conocimiento estable"],
      ["ops/CURRENT.md", "el estado operativo actual"],
      ["ops/tasks/TEMPLATE.md", "la plantilla de TASK"],
      [".agents/skills/", "los procedimientos"],
      ["ops/references/stitch/design-system.md", "el sistema de diseño oficial"],
      ["ops/production-readiness.md", "el runbook de producción"],
    ];

    const missing = expected.filter(([needle]) => !agents.includes(needle)).map(([, why]) => why);

    expect(
      missing,
      "AGENTS.md tiene que enlazar cada responsabilidad: la regla general se queda en AGENTS y el detalle va al documento que corresponde",
    ).toEqual([]);
  });

  it("AGENTS.md conserva los guardrails que ya existían antes de la reorganización", () => {
    const agents = readRepoFile("AGENTS.md");

    // No se custodia la redacción: se custodia que ninguna regla dura se haya perdido al repartir el
    // contenido entre AGENTS, CONTEXT y las skills.
    const guardrails: Array<[string, string]> = [
      ["50 líneas", "el tope de los route handlers"],
      ["400 líneas por archivo", "el tope de tamaño de archivo"],
      ["80 por función", "el tope de tamaño de función"],
      ["@prisma/client", "la prohibición de Prisma en un route handler"],
      ["--squash", "el merge por squash"],
      ["ruleset", "la protección real de main"],
      ["publish", "el check que nunca es required"],
      ["build:webpack", "el build extra cuando se toca una página"],
      ["security:secrets", "el chequeo de secretos"],
      ["db:seed", "la prohibición de seed en producción"],
      ["migrate reset", "la prohibición de reset en producción"],
      ["375 px", "la verificación mobile"],
      ["design-tokens.allow.json", "los techos de UI"],
      ["order-totals.ts", "la única fuente de los totales"],
      ["timingSafeEqual", "el fail-closed de los endpoints internos"],
      ["Mutation check", "el mutation check"],
      ["Coverage", "coverage no es correctness"],
      ["TDD", "el TDD obligatorio"],
      ["puerto completo", "los dobles implementan el puerto completo"],
      ["--bg-canvas", "el lienzo del panel"],
      ["--sidebar-", "los tokens muertos no vuelven"],
      ["handoffs", "docs/ y handoffs/ no son fuente de verdad"],
    ];

    const missing = guardrails.filter(([needle]) => !agents.includes(needle)).map(([, why]) => why);

    expect(
      missing,
      "se perdió un guardrail al repartir el contenido: recuperalo (en AGENTS o enlazando la skill) o explicá por qué ya no aplica",
    ).toEqual([]);
  });

  it("CLAUDE.md sigue siendo un adapter y no duplica el manual", () => {
    const claude = readRepoFile("CLAUDE.md");

    expect(claude, "CLAUDE.md tiene que declarar a AGENTS.md como autoridad").toContain("AGENTS.md");
    expect(
      countLines("CLAUDE.md"),
      "CLAUDE.md es un adapter: si necesita más de estas líneas, la regla que falta va en AGENTS.md",
    ).toBeLessThanOrEqual(MAX_LINES["CLAUDE.md"]);
  });

  it("ops/CURRENT.md es el estado actual y apunta a la cola, el roadmap y el runbook", () => {
    const current = readRepoFile("ops/CURRENT.md");

    const expected: Array<[string, string]> = [
      ["audit-backlog.md", "la cola de hallazgos"],
      ["AUDIT-REMEDIATION-ROADMAP.md", "el programa de remediación"],
      ["production-readiness.md", "el runbook"],
      [".agents/CONTEXT.md", "el contexto estable"],
    ];

    const missing = expected.filter(([needle]) => !current.includes(needle)).map(([, why]) => why);

    expect(missing, "CURRENT.md tiene que llevar a dónde está el resto").toEqual([]);
  });

  it("el estado histórico quedó separado y project-state ya no se presenta como el estado actual", () => {
    expect(
      fileExists(LEGACY_STATE_DOCUMENT),
      "la historia no se borra: el project-state original se archiva entero",
    ).toBe(true);

    expect(
      countLines(LEGACY_STATE_DOCUMENT),
      "el archivo archivado tiene que conservar el contenido (era de miles de líneas)",
    ).toBeGreaterThan(1000);

    if (fileExists("ops/project-state.md")) {
      const shim = readRepoFile("ops/project-state.md");

      expect(
        shim,
        "si se conserva project-state.md, tiene que decir inequívocamente que el estado vigente es CURRENT.md",
      ).toContain("ops/CURRENT.md");

      expect(
        countLines("ops/project-state.md"),
        "project-state.md quedó como puntero: si crece, es que volvió a ser una segunda fuente de verdad",
      ).toBeLessThanOrEqual(MAX_LINES["ops/project-state.md"]);
    }
  });

  it("ningún documento del sistema operativo volvió a ser un diario", () => {
    const tooLong = Object.entries(MAX_LINES)
      .filter(([doc]) => fileExists(doc))
      .filter(([doc, max]) => countLines(doc) > max)
      .map(([doc, max]) => `${doc}: ${countLines(doc)} > ${max}`);

    expect(
      tooLong,
      "el techo de un documento solo baja: lo que sobra se mueve a history, a una skill o al backlog",
    ).toEqual([]);
  });

  it("`.agents/` está versionado: el sistema no puede quedar fuera de git", () => {
    const gitignore = readRepoFile(".gitignore")
      .split("\n")
      .map((line) => line.trim());

    // Un patrón sin barra matchea a cualquier profundidad, así que una línea `.agents` (o `.agents/`)
    // saca del repo a todo el sistema operativo del agente — y en un clon nuevo no existe nada.
    const wholeDirectoryIgnored = gitignore.some(
      (line) => line === ".agents" || line === ".agents/" || line === "/.agents" || line === "/.agents/",
    );

    expect(
      wholeDirectoryIgnored,
      "`.agents` no puede estar ignorado entero: CONTEXT/MEMORY/README y las skills propias se versionan (los volcados de skills de terceros se ignoran uno por uno)",
    ).toBe(false);

    // Cada pieza versionada tiene que estar efectivamente afuera del ignore.
    const versioned = [
      ".agents/CONTEXT.md",
      ".agents/MEMORY.md",
      ".agents/README.md",
      ...REQUIRED_SKILLS.map((skill) => `.agents/skills/${skill}/SKILL.md`),
    ];

    expect(
      versioned.filter((path) => !fileExists(path)),
      "los archivos del sistema tienen que existir en el repo, no solo en el disco local",
    ).toEqual([]);
  });
});
