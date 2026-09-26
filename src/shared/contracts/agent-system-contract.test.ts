import { describe, expect, it } from "vitest";

import { countLines, fileExists, listFiles, readRepoFile } from "./contract-files";

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
  "delivery-e2e",
  "bugfix",
  "money-change",
  "database-migration",
  "security-change",
  "ui-change",
  "screen-design",
  "audit",
  "production-release",
] as const;

const REQUIRED_TASK_DOCUMENTS = [
  "ops/tasks/START-HERE.md",
  "ops/tasks/TEMPLATE.md",
  "ops/tasks/AUDIT-REMEDIATION-ROADMAP.md",
] as const;

/**
 * ARCH-001 (2026-09-25) — la **arquitectura de producto**: dónde vive cada capacidad y quién es dueño de
 * sus reglas.
 *
 * Decidir si una feature «pertenece» a Caja o a Órdenes necesita criterio, así que ese gate **no** se
 * automatiza (vive en el documento). Lo que sí es objetivo: que la fuente canónica exista una sola vez,
 * que el camino de entrada la cite y que las skills que crean capacidades nuevas la consulten en lugar de
 * improvisar una arquitectura paralela.
 */
const MODULE_ARCHITECTURE_DOC = "ops/product/MODULE_ARCHITECTURE.md";

/** Las skills que crean capacidades o pantallas nuevas: son las que tienen que consultarla antes. */
const SKILLS_THAT_CONSULT_ARCHITECTURE = ["new-task", "ui-change"] as const;

/**
 * Un techo para la constitución de producto: el mismo principio que el resto de los documentos del
 * sistema —si crece como un manual, dejó de ser la fuente corta que un agente lee antes de decidir—.
 */
const MAX_MODULE_ARCHITECTURE_LINES = 400;

/** El archivo del que salió esta reorganización. No se borra: se archiva. */
const LEGACY_STATE_DOCUMENT = "ops/history/project-state-legacy-2026-09.md";

/**
 * Techos de tamaño. Son deliberadamente holgados: no buscan el número justo, buscan que ningún archivo
 * vuelva a mezclar todas las responsabilidades.
 *
 * **`AGENTS.md` no está acá a propósito**: su techo (≤ 300 líneas, porque es el archivo que todo agente
 * lee primero) ya lo custodia `design-system-contract.test.ts`. Repetir el número sería crear una segunda
 * fuente de verdad para la misma regla — justo lo que `AGENTS.md` prohíbe.
 */
const MAX_LINES = {
  ".agents/CONTEXT.md": 400,
  ".agents/MEMORY.md": 400,
  "ops/CURRENT.md": 250,
  "CLAUDE.md": 40,
  // El puntero de compatibilidad: si crece, es que alguien volvió a escribir estado adentro.
  "ops/project-state.md": 60,
  /**
   * DS-001 — la ley visual es una constitución mínima, no un manual: si crece, el detalle va a una skill,
   * a una spec de pantalla o al archivo histórico. Techos medidos el 2026-09-25 (387 / 168 / 143 / 73 / 106
   * líneas): solo bajan.
   */
  "ops/design/DESIGN_SYSTEM.md": 400,
  "ops/design/CONTENT.md": 200,
  "ops/design/PATTERNS.md": 200,
  "ops/design/MOTION.md": 150,
  "ops/design/DATA_VISUALIZATION.md": 200,
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
      ["ops/design/DESIGN_SYSTEM.md", "la ley visual"],
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

  it("la arquitectura de producto es una sola fuente y el camino de entrada la cita", () => {
    expect(
      fileExists(MODULE_ARCHITECTURE_DOC),
      `falta ${MODULE_ARCHITECTURE_DOC}: sin la fuente canónica cada agente decide de nuevo dónde vive cada capacidad`,
    ).toBe(true);

    const mustCite = [
      "AGENTS.md",
      "ops/CURRENT.md",
      "ops/tasks/START-HERE.md",
      ...SKILLS_THAT_CONSULT_ARCHITECTURE.map((skill) => `.agents/skills/${skill}/SKILL.md`),
    ];

    const missing = mustCite.filter(
      (doc) => !readRepoFile(doc).includes(MODULE_ARCHITECTURE_DOC),
    );

    expect(
      missing,
      "un documento que crea capacidades nuevas tiene que consultar la arquitectura de producto, no repetirla ni improvisarla",
    ).toEqual([]);
  });

  it("la arquitectura de producto enlaza la autoridad del repo en vez de duplicarla", () => {
    const doc = readRepoFile(MODULE_ARCHITECTURE_DOC);

    expect(
      doc,
      "la arquitectura de producto no reemplaza a AGENTS.md: lo enlaza",
    ).toContain("AGENTS.md");

    expect(
      doc,
      "el contexto técnico estable vive en CONTEXT.md y se enlaza, no se copia",
    ).toContain(".agents/CONTEXT.md");

    expect(
      countLines(MODULE_ARCHITECTURE_DOC),
      "es una constitución mínima: si crece como un manual, el detalle va a una skill o al backlog",
    ).toBeLessThanOrEqual(MAX_MODULE_ARCHITECTURE_LINES);
  });

  it("ninguna otra constitución activa se proclama dueña de la arquitectura de producto", () => {
    /**
     * Propiedad objetiva: **una sola** declaración de autoridad. Un documento que se proclame fuente de la
     * arquitectura de producto tiene que ser el canónico; si aparece un segundo, este contrato lo delata
     * antes de que dos documentos se contradigan en silencio. La historia archivada queda afuera a
     * propósito: `ops/history/` no es fuente de verdad.
     */
    const AUTHORITY_CLAIM = "fuente de la arquitectura de producto";

    const normativeDocs = [
      ...listFiles(
        "ops",
        (repoPath) => repoPath.endsWith(".md") && !repoPath.startsWith("ops/history/"),
      ),
      ...listFiles(".agents", (repoPath) => repoPath.endsWith(".md")),
    ];

    const claimants = normativeDocs
      .filter((repoPath) => readRepoFile(repoPath).includes(AUTHORITY_CLAIM))
      .sort();

    expect(
      claimants,
      "dos documentos no pueden proclamarse dueños de la arquitectura de producto: se escribe una vez y se enlaza",
    ).toEqual([MODULE_ARCHITECTURE_DOC]);
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

/**
 * TASK-OPS-001 — **contrato de entrega E2E por defecto**.
 *
 * La decisión del owner: una TASK aprobada se ejecuta hasta el estado operativo final **sin pedir permisos
 * intermedios** para PR, merge o deploy. Este guardrail custodia lo **objetivo** de esa decisión, no su
 * redacción:
 *
 * 1. la política existe **una sola vez** y nombra los tres modos;
 * 2. `production-release` ya no pide un segundo OK, pero **conserva** los guardrails del deploy;
 * 3. `new-task` declara el modo al arrancar y la plantilla lo pide;
 * 4. ningún documento **activo** vuelve a exigir backup manual por frecuencia;
 * 5. el deploy sigue siendo **solo desde `main` y con CI verde**.
 *
 * Lo que este contrato **no** hace: decidir riesgo de negocio. Ningún regex puede saber si un cambio toca
 * dinero; eso lo declara el humano en el Delivery Mode y lo resuelven las skills de cada clase de riesgo.
 */
const DELIVERY_POLICY_SKILL = ".agents/skills/delivery-e2e/SKILL.md";
const DELIVERY_MODES = ["docs-only", "runtime-e2e", "high-risk-e2e"] as const;

/** La frase que se proclama dueña de la política: una sola, como la de la arquitectura de producto. */
const DELIVERY_AUTHORITY_CLAIM = "fuente de la política de entrega";

/** La regla vieja, textual: si vuelve a un documento activo, este contrato la delata. */
const MANUAL_BACKUP_RULE = /backup manual antes de cada deploy|antes de cada deploy[^.]{0,120}backup manual/i;

/**
 * Documentos activos: la constitución, el mapa del sistema y todo `ops/` que no sea historia.
 * `ops/history/` queda afuera a propósito: la historia **no se reescribe**.
 */
function activeGovernanceDocs(): string[] {
  const candidates = [
    "AGENTS.md",
    "CLAUDE.md",
    ...listFiles(".agents", (repoPath) => repoPath.endsWith(".md")),
    ...listFiles("ops", (repoPath) => repoPath.endsWith(".md") && !repoPath.startsWith("ops/history/")),
  ];

  return Array.from(new Set(candidates)).filter(fileExists).sort();
}

describe("contrato · entrega E2E por defecto (TASK-OPS-001)", () => {
  it("cada skill obligatoria está fuera del ignore: existir en el disco no alcanza", () => {
    /**
     * Un archivo puede existir en la máquina y **no** estar en el repo: `.agents/skills/*` está ignorado y
     * cada skill propia se habilita con una línea `!`. Así se coló una skill nueva durante TASK-OPS-001: el
     * contrato la veía en el disco y el clon no la tenía. La propiedad objetiva es la negación explícita.
     */
    const gitignore = readRepoFile(".gitignore").split("\n").map((line) => line.trim());

    const sinVersionar = REQUIRED_SKILLS.filter(
      (skill) => !gitignore.includes(`!.agents/skills/${skill}/`),
    ).map((skill) => `.agents/skills/${skill}/`);

    expect(
      sinVersionar,
      "una skill obligatoria sin su `!` en .gitignore existe en el disco y falta en el repo: el sistema operativo del agente no se versiona a medias",
    ).toEqual([]);
  });

  it("la política de entrega existe, es una sola fuente y nombra los tres modos", () => {
    expect(
      fileExists(DELIVERY_POLICY_SKILL),
      `falta ${DELIVERY_POLICY_SKILL}: sin la política escrita, cada sesión vuelve a preguntar si mergea o despliega`,
    ).toBe(true);

    const policy = readRepoFile(DELIVERY_POLICY_SKILL);

    const missingModes = DELIVERY_MODES.filter((mode) => !policy.includes(mode));

    expect(
      missingModes,
      "la política tiene que nombrar los tres modos: es lo que el humano elige una vez y el agente ejecuta",
    ).toEqual([]);

    const required: Array<[string, string]> = [
      ["stop condition", "las condiciones de parada reales, no la duda del agente"],
      ["destructiva", "la operación destructiva en producción"],
      ["backfill", "el backfill/reparación de datos sin aprobar"],
      ["secreto", "el secreto o permiso externo que no existe"],
      ["p0/p1", "el incidente nuevo causado por la TASK"],
    ];

    // Sin distinguir mayúsculas: la política nombra las condiciones como títulos y el chequeo custodia el
    // concepto, no la tipografía.
    const haystack = policy.toLowerCase();
    const missing = required.filter(([needle]) => !haystack.includes(needle)).map(([, why]) => why);

    expect(missing, "a la política le falta una condición de parada o una regla dura").toEqual([]);

    // Una sola declaración de autoridad: si un segundo documento se proclama dueño, se contradicen.
    const claimants = activeGovernanceDocs()
      .filter((repoPath) => readRepoFile(repoPath).includes(DELIVERY_AUTHORITY_CLAIM))
      .sort();

    expect(
      claimants,
      "la política de entrega se escribe una vez y se enlaza: dos fuentes terminan contradiciéndose",
    ).toEqual([DELIVERY_POLICY_SKILL]);
  });

  it("production-release ya no exige una segunda autorización, pero conserva los guardrails del deploy", () => {
    const skill = readRepoFile(".agents/skills/production-release/SKILL.md");

    const segundaAutorizacion = skill.match(/OK explícito del owner|con el OK del owner|sin el OK del owner/i);

    expect(
      segundaAutorizacion?.[0] ?? null,
      "el deploy ya no se autoriza dos veces: la aprobación de una TASK de runtime (o el Delivery Mode declarado) alcanza, salvo Stop Condition",
    ).toBeNull();

    const required: Array<[string, string]> = [
      ["CI verde", "el deploy sigue esperando el CI verde"],
      ["main", "el deploy sale solo de main"],
      ["autoriza", "la semántica nueva: la aprobación de la TASK autoriza el release"],
      ["deployService", "una sola llamada a deployService"],
      ["forceRebuild", "el rebuild explícito"],
      ["/api/health", "la verificación de health"],
      ["/api/readiness", "la verificación de readiness"],
      ["test:e2e:prod", "los smokes posteriores"],
      ["commit.sha", "la confirmación del sha desplegado"],
      ["db:seed", "la prohibición de seed en producción"],
      ["migrate reset", "la prohibición de reset en producción"],
      ["cacommerce", "la prohibición de tocar servicios ajenos"],
      ["Rollback", "el rollback documentado"],
    ];

    const missing = required.filter(([needle]) => !skill.includes(needle)).map(([, why]) => why);

    expect(
      missing,
      "cambiar la autorización no puede aflojar el procedimiento: los guardrails del deploy quedan intactos",
    ).toEqual([]);
  });

  it("new-task declara el Delivery Mode al arrancar y no pide elegirlo cuando es inferible", () => {
    const skill = readRepoFile(".agents/skills/new-task/SKILL.md");

    const missingModes = DELIVERY_MODES.filter((mode) => !skill.includes(mode));

    expect(
      missingModes,
      "el arranque de una TASK tiene que declarar su modo de entrega: es lo que decide si hay deploy",
    ).toEqual([]);

    expect(
      skill.includes("Delivery Mode") || skill.includes("DELIVERY MODE"),
      "el gate de arranque tiene que nombrar el campo que se completa",
    ).toBe(true);

    expect(
      /inferible|se infiere|no se pregunta/i.test(skill),
      "el modo se infiere del brief: no se le pide al owner que elija cuando ya se sabe",
    ).toBe(true);
  });

  it("la plantilla de TASK pide el Delivery Mode y las stop conditions de esa TASK", () => {
    const template = readRepoFile("ops/tasks/TEMPLATE.md");

    const missingModes = DELIVERY_MODES.filter((mode) => !template.includes(mode));

    expect(
      missingModes,
      "una TASK sin modo de entrega declarado no sabe si termina en merge o en producción",
    ).toEqual([]);

    expect(
      template.includes("STOP CONDITIONS"),
      "la plantilla tiene que pedir las condiciones de parada propias de la TASK (no repetir el procedimiento)",
    ).toBe(true);
  });

  it("ningún documento activo vuelve a exigir backup manual por frecuencia", () => {
    const offenders = activeGovernanceDocs()
      .filter((repoPath) => MANUAL_BACKUP_RULE.test(readRepoFile(repoPath)))
      .sort();

    expect(
      offenders,
      "el backup se decide por riesgo del release, no por frecuencia: la regla vieja no puede volver a un documento activo",
    ).toEqual([]);

    const policy = readRepoFile(DELIVERY_POLICY_SKILL);

    expect(
      /por riesgo/i.test(policy) && /backup/i.test(policy),
      "la política tiene que decir explícitamente que el backup se decide por riesgo del release",
    ).toBe(true);
  });
});
