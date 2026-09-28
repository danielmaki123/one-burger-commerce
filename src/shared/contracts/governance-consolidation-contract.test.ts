import { describe, expect, it } from "vitest";

import { countLines, countMatches, fileExists, listFiles, readRepoFile } from "./contract-files";

/**
 * TASK-GOV-001 — **consolidación de arquitectura, reglas y roadmap**.
 *
 * El problema que este contrato custodia: el repo acumuló **dos roadmaps**, **dos arquitecturas objetivo**
 * y **las mismas leyes escritas con dos redacciones**. Un agente nuevo no puede decidir con dos fuentes
 * que se contradicen en silencio.
 *
 * Qué se automatiza acá (solo propiedades **mecánicas**, nada semántico):
 *
 * 1. las **leyes del repo** viven en `AGENTS.md` (nombre canónico + regla en una línea) y **nadie más las
 *    reescribe completas**: los otros documentos las enlazan;
 * 2. la **segunda fuente de derecho** material: la orden autoritativa del roadmap está en **un solo**
 *    documento y es exactamente la que el owner aprobó;
 * 3. el **flujo obligatorio** existe una sola vez y con sus pasos en orden;
 * 4. **`NEXT.md` es pequeño** y `CURRENT.md` dejó de afirmar cuál es la próxima pantalla;
 * 5. la **arquitectura objetivo** (visible y de módulos) está declarada y las capacidades están
 *    clasificadas `ACTIVE` / `FROZEN` / `LEGACY` / `FUTURE`;
 * 6. las **skills de UI** mencionan el reuse audit, el viewport contract y el design freeze.
 *
 * Qué **no** se automatiza —y no se va a inventar un regex para eso—: decidir si una capacidad «pertenece»
 * a Caja o a Órdenes, si una desviación de la referencia es «material», o si un documento «se contradice»
 * en el sentido de negocio. Eso lo resuelve el criterio, con `MODULE_ARCHITECTURE.md` §2/§5/§10 delante.
 */

const AGENTS_DOC = "AGENTS.md";
const ARCHITECTURE_DOC = "ops/product/MODULE_ARCHITECTURE.md";
const MASTER_ROADMAP = "ops/roadmap/PRODUCT-UX-ROADMAP.md";
const NEXT_DOC = "ops/roadmap/NEXT.md";
const CURRENT_DOC = "ops/CURRENT.md";
const DELIVERY_SKILL = ".agents/skills/delivery-e2e/SKILL.md";
const TASK_TEMPLATE = "ops/tasks/TEMPLATE.md";

/**
 * Las seis leyes y la séptima que se incorporó en `TASK-GOV-001`. El **nombre** es el identificador que
 * un agente cita; la frase es la **afirmación mínima** que tiene que estar en `AGENTS.md` y en ningún
 * otro documento activo. Si una ley se reescribe completa en otro lado, este contrato lo delata.
 */
const LAWS: Array<{ name: string; statement: string; doc: string }> = [
  {
    name: "Reuse First",
    statement: "Antes de crear, buscar",
    doc: ARCHITECTURE_DOC,
  },
  {
    name: "Reuse Audit",
    statement: "REUSE AUDIT es un gate obligatorio",
    doc: ARCHITECTURE_DOC,
  },
  {
    name: "One Canonical Flow",
    statement: "Cada operación de negocio tiene un solo flujo canónico",
    doc: ARCHITECTURE_DOC,
  },
  {
    name: "Single Owner",
    statement: "Una entidad tiene un solo módulo dueño de sus reglas",
    doc: ARCHITECTURE_DOC,
  },
  {
    name: "Reference Fidelity",
    statement: "La referencia aprobada es contrato, no inspiración",
    doc: "ops/design/DESIGN_SYSTEM.md",
  },
  {
    name: "Viewport Contract",
    // La regla en una línea; la **enumeración** de los cuatro viewports es el procedimiento de QA y vive en
    // la ley visual (`DESIGN_SYSTEM.md` §12) y en las skills, que la aplican.
    statement: "se valida en viewport completo",
    doc: "ops/design/DESIGN_SYSTEM.md",
  },
];

/** La ley incorporada como **arquitectura**, no como estilo: configuración vs. hechos históricos. */
const SNAPSHOT_LAW_STATEMENT =
  "Configuration has one owner; transactions snapshot it";

/**
 * La declaración de autoridad: una sola, como la de la arquitectura de producto y la de entrega. La
 * comparación va en minúsculas porque `reading()` normaliza el texto de los documentos.
 */
const LAW_AUTHORITY_CLAIM = "autoridad de las leyes del repo";

/** El roadmap es **uno solo**: si un segundo documento se proclama maestro, este contrato lo delata. */
const ROADMAP_AUTHORITY_CLAIM = "fuente del roadmap maestro de producto y UX";

/** Los 17 ítems del orden autoritativo, con el texto que el owner aprobó, en ese orden. */
const ROADMAP_ITEMS = [
  "0. Gobierno y reglas",
  "1. POS Fase 1",
  "2. Consolidación arquitectónica",
  "3. Separar Pedidos / Cocina",
  "4. Money ownership",
  "5. Payments ownership",
  "6. Pedido existente → Cobrar en POS",
  "7. Cash ownership",
  "8. Separar Configuración: Negocio / Finanzas / Personalización / Locales",
  "9. Separar Cierres / Facturas",
  "10. Promotions ownership",
  "11. Consolidar /activity + /orders + /orders/track",
  "12. Clasificar y sanear FROZEN/LEGACY",
  "13. Check únicamente si aparece necesidad real",
  "14. Table Service/Mesas",
  "15. Refinamiento restante de Catálogo",
  "16. Resumen, cuando las fuentes estén maduras",
] as const;

/**
 * Los pasos del flujo obligatorio, en orden y **en minúsculas** (es la forma en que `reading()` normaliza el
 * documento, así la comparación es por contenido y no por tipografía). La etiqueta larga se usa solo en los
 * mensajes de error.
 */
const FLOW_STEPS = [
  "auditoría real",
  "reuse audit",
  "ownership",
  "spec",
  "reference.html",
  "design freeze",
  "implementación",
  "tests",
  "pr/ci",
  "merge",
  "deploy",
  "qa de producción",
  "auditoría independiente",
  "current/roadmap",
  "stop",
] as const;

/** El flujo vive una sola vez: `delivery-e2e` es su fuente. */
const FLOW_AUTHORITY_CLAIM = "fuente del flujo obligatorio";

/** El encabezado de la sección que lista el flujo: lo de antes es introducción, no secuencia. */
const FLOW_SECTION_HEADING = "## 1. El flujo obligatorio";

/** La arquitectura visible objetivo: los cuatro bloques con su contenido exacto. */
const VISIBLE_ARCHITECTURE = [
  "Resumen",
  "Operación: Pedidos · Cocina · POS",
  "Control: Caja · Cierres · Facturas · Aprobaciones · Config de Caja",
  "Catálogo: Productos · Categorías · Modificadores · Promociones · Contenido",
  "Configuración: Locales · Negocio · Finanzas · Personalización · Usuarios · Alertas",
] as const;

/** Arquitectura **objetivo** de módulos: se documenta, no se crea todavía. */
const TARGET_MODULES = ["payments", "money", "cash", "promotions", "invoices"] as const;

/** Clasificación de capacidades. Cada etiqueta aparece una sola vez, con su significado. */
const CAPABILITY_STATUSES = [
  { code: "ACTIVE", meaning: "ofrecida hoy" },
  { code: "FROZEN", meaning: "código presente, no ofrecida" },
  { code: "LEGACY", meaning: "huérfana" },
  { code: "FUTURE", meaning: "arquitectura objetivo" },
] as const;

/** Las capacidades que la TASK tiene que clasificar explícitamente. */
const CAPABILITIES = [
  "Inventario",
  "Reservas",
  "Delivery Zones",
  "Mesas legacy",
  "table-ordering",
  "coupons",
] as const;

/**
 * El flujo se verifica por su **forma** y su **orden**, no por su redacción: `delivery-e2e` es su única
 * fuente, el procedimiento se escribe encadenado con flechas (`→`) y los pasos aparecen en secuencia. Se
 * custodia eso; interpretar si un paso «equivale» a otro no se automatiza.
 */
const MIN_FLOW_ARROWS = FLOW_STEPS.length;

/**
 * Documentos **activos** (no historia): la constitución, el mapa del sistema, las skills y todo `ops/`
 * que no sea `ops/history/`. Es el mismo universo que vigilan los otros contratos de gobernanza.
 */
function activeGovernanceDocs(): string[] {
  const candidates = [
    AGENTS_DOC,
    "CLAUDE.md",
    ...listFiles(".agents", (repoPath) => repoPath.endsWith(".md")),
    ...listFiles("ops", (repoPath) => repoPath.endsWith(".md") && !repoPath.startsWith("ops/history/")),
  ];

  return Array.from(new Set(candidates)).filter(fileExists).sort();
}

/**
 * Un documento markdown se lee con el ancho de la columna: una frase puede quedar partida en dos líneas —o
 * una palabra cortada con guion— y el énfasis (`**`, tildes invertidas) es tipografía, no contenido. El
 * contrato compara **texto normalizado** (sin énfasis, sin mayúsculas de adorno, con los espacios
 * colapsados), que es la forma de custodiar una ley sin volverlo un test de formato.
 */
function reading(source: string): string {
  return source
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

describe("contrato · consolidación de arquitectura, reglas y roadmap (TASK-GOV-001)", () => {
  it("las leyes del repo existen una sola vez, nombradas y con su autoridad", () => {
    const agents = reading(readRepoFile(AGENTS_DOC));

    const missing = LAWS.filter(
      (law) => !agents.includes(law.name.toLowerCase()) || !agents.includes(reading(law.statement)),
    ).map((law) => law.name);

    expect(
      missing,
      "cada ley vive en AGENTS.md con su nombre canónico y su regla en una línea: el nombre es lo que un agente cita y la ley no se escribe completa dos veces",
    ).toEqual([]);

    expect(
      agents,
      "AGENTS.md tiene que declarar la autoridad de las leyes una sola vez",
    ).toContain(LAW_AUTHORITY_CLAIM);

    const claimants = activeGovernanceDocs()
      .filter((repoPath) => reading(readRepoFile(repoPath)).includes(LAW_AUTHORITY_CLAIM))
      .sort();

    expect(
      claimants,
      "las leyes se escriben una vez y se enlazan: dos documentos proclamándose dueños terminan contradiciéndose",
    ).toEqual([AGENTS_DOC]);
  });

  it("la ley de configuración y snapshots es arquitectónica, no un detalle de implementación", () => {
    const agents = reading(readRepoFile(AGENTS_DOC));

    expect(
      agents,
      "Configuration has one owner; transactions snapshot it es ley arquitectónica: una configuración mutable tiene una sola autoridad y los hechos históricos congelan los valores que los explican",
    ).toContain(reading(SNAPSHOT_LAW_STATEMENT));

    expect(
      agents,
      "La ley tiene que decir que el pasado no se reconstruye con la configuración actual",
    ).toContain("reconstruir el pasado");
  });

  it("ninguna ley se reescribe completa fuera de AGENTS.md", () => {
    const offenders: string[] = [];

    for (const doc of activeGovernanceDocs()) {
      if (doc === AGENTS_DOC) {
        continue;
      }

      const source = reading(readRepoFile(doc));

      for (const law of LAWS) {
        if (source.includes(reading(law.statement))) {
          offenders.push(`${doc}: reescribe «${law.name}» (la autoridad es ${law.doc})`);
        }
      }

      if (source.includes(reading(SNAPSHOT_LAW_STATEMENT))) {
        offenders.push(`${doc}: reescribe «Configuration has one owner; transactions snapshot it»`);
      }
    }

    expect(
      offenders,
      "una autoridad + referencias: el documento que detalla una ley la enlaza, no la vuelve a enunciar",
    ).toEqual([]);
  });

  it("el roadmap maestro es uno solo y contiene el orden autoritativo completo, en orden", () => {
    expect(
      fileExists(MASTER_ROADMAP),
      `falta ${MASTER_ROADMAP}: sin un solo roadmap, la secuencia la elige cada sesión`,
    ).toBe(true);

    const roadmap = reading(readRepoFile(MASTER_ROADMAP));

    const missing = ROADMAP_ITEMS.filter((item) => !roadmap.includes(reading(item)));

    expect(
      missing,
      "el orden autoritativo se escribe una vez, completo y con el texto aprobado por el owner",
    ).toEqual([]);

    const ordered = ROADMAP_ITEMS.map((item) => roadmap.indexOf(reading(item)));

    expect(
      ordered,
      "el roadmap no ordena: los 17 ítems tienen que aparecer en el orden autoritativo, no en cualquier orden",
    ).toEqual([...ordered].sort((a, b) => a - b));

    const claimants = activeGovernanceDocs()
      .filter((repoPath) => readRepoFile(repoPath).includes(ROADMAP_AUTHORITY_CLAIM))
      .sort();

    expect(
      claimants,
      "solo el roadmap maestro puede proclamarse maestro: el resto lo enlaza",
    ).toEqual([MASTER_ROADMAP]);
  });

  it("el flujo obligatorio existe una sola vez, con sus pasos y en orden", () => {
    const flow = reading(readRepoFile(DELIVERY_SKILL));
    expect(
      flow,
      "la secuencia de trabajo se escribe una vez: en el flujo de entrega",
    ).toContain(FLOW_AUTHORITY_CLAIM);

    expect(
      countMatches(flow, /→/g),
      `el flujo tiene que listar sus pasos encadenados: ${FLOW_STEPS.join(" → ")}`,
    ).toBeGreaterThanOrEqual(MIN_FLOW_ARROWS);

    // Y en orden: cada paso aparece **después** del anterior, dentro de la sección del flujo (las palabras
    // sueltas como «¿mergeo?» en la introducción no cuentan: el flujo empieza en su encabezado).
    const missingSteps = FLOW_STEPS.filter(
      (step) => !new RegExp(`${step.replace(/[/.]/g, "\\$&")}\\b`, "i").test(flow),
    );

    expect(
      missingSteps,
      "al flujo le falta un paso de la secuencia obligatoria",
    ).toEqual([]);

    // Y en orden: cada paso aparece **después** del anterior, dentro de la sección del flujo (las palabras
    // sueltas como «¿mergeo?» de la introducción no cuentan: el flujo empieza en el encabezado de su sección).
    const flowBody = flow.slice(flow.indexOf(reading(FLOW_SECTION_HEADING)));
    const positions = FLOW_STEPS.map((step) => flowBody.indexOf(step));

    expect(
      positions,
      "el flujo enumera sus pasos fuera de orden: la secuencia es la del repo, no la que convenga",
    ).toEqual([...positions].sort((a, b) => a - b));

    expect(
      flow.includes(reading("Una sola TASK")),
      "una sola TASK de runtime activa por vez es parte del flujo",
    ).toBe(true);

    expect(
      flow.includes(reading("no equivale a aceptación")),
      "el deploy no equivale a aceptación: la aceptación es la auditoría independiente contra spec/reference",
    ).toBe(true);

    const claimants = activeGovernanceDocs()
      .filter((repoPath) => reading(readRepoFile(repoPath)).includes(reading(FLOW_AUTHORITY_CLAIM)))
      .sort();

    expect(claimants, "el flujo se escribe una vez y se enlaza").toEqual([DELIVERY_SKILL]);
  });

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el contrato cambió **a propósito**.
   *
   * Antes exigía que `NEXT.md` declarara «Ninguno» en `ACTIVE`. Eso describía el estado del repo cuando se
   * escribió el contrato (entre TASKs), no la regla: la regla es **una TASK activa por vez**, y una TASK
   * abierta y en curso **tiene** que poder declararse en `ACTIVE`. Lo que el contrato tiene que cuidar es
   * que nunca haya **dos**, que la próxima siga necesitando autorización del owner, y que `NEXT.md` siga
   * siendo la secuencia y no un segundo roadmap.
   */
  it("NEXT.md es pequeño, declara a lo sumo UNA TASK activa y apunta a la próxima TASK y al roadmap maestro", () => {
    expect(countLines(NEXT_DOC)).toBeLessThanOrEqual(60);

    const next = readRepoFile(NEXT_DOC);

    const expected: Array<[string, string]> = [
      ["## ACTIVE", "lo que se está haciendo ahora"],
      ["## NEXT", "lo que sigue"],
      ["## LATER", "lo que queda lejos"],
      ["autorización explícita del owner", "que la próxima TASK no se abre sola"],
      ["Pedidos", "la próxima TASK"],
      ["roadmap maestro", "el roadmap maestro"],
    ];

    const missing = expected.filter(([needle]) => !next.includes(needle)).map(([, why]) => why);

    expect(missing, "NEXT.md es la secuencia inmediata, no un segundo roadmap").toEqual([]);

    /**
     * `ACTIVE` dice la verdad: o no hay nada en curso (`**Ninguno.**`) o hay **una** TASK nombrada. Dos
     * TASKs activas a la vez es exactamente lo que la regla prohíbe.
     */
    const activeBody = next.split("## NEXT")[0].replace("## ACTIVE", "");
    const activeTaskIds = [...new Set(activeBody.match(/TASK-[A-Z0-9-]+/g) ?? [])];

    if (activeBody.includes("**Ninguno.**")) {
      expect(activeTaskIds, "sin TASK activa no puede haber ids sueltos en ACTIVE").toEqual([]);
    } else {
      expect(
        activeTaskIds,
        "una sola TASK activa por vez: `ACTIVE` nombra exactamente una",
      ).toHaveLength(1);
    }

    expect(
      next,
      "NEXT.md no decide la próxima pantalla de producto: eso vive en el roadmap maestro",
    ).not.toContain("SCREEN-001");
  });

  it("CURRENT.md dejó de afirmar que Resumen es lo próximo y apunta al roadmap maestro", () => {
    const current = readRepoFile(CURRENT_DOC);

    expect(
      current,
      "el estado tiene que llevar al roadmap vigente, no a una secuencia paralela",
    ).toContain(MASTER_ROADMAP);

    expect(
      current,
      "la próxima pantalla dejó de ser Resumen: ahora la secuencia la manda el roadmap maestro",
    ).not.toContain("SCREEN-001");
  });

  it("la arquitectura objetivo está declarada: visible y de módulos, sin crearlos", () => {
    const architecture = reading(readRepoFile(ARCHITECTURE_DOC));

    const missingBlocks = VISIBLE_ARCHITECTURE.filter(
      (block) => !architecture.includes(reading(block)),
    );

    expect(
      missingBlocks,
      "la arquitectura visible objetivo se documenta una vez: es dirección, no el sidebar de hoy",
    ).toEqual([]);

    const missingModules = TARGET_MODULES.filter((module) => !architecture.includes(module));
    expect(
      missingModules,
      "los módulos objetivo (payments, money, cash, promotions, invoices) se documentan: crearlos no es parte de esta TASK",
    ).toEqual([]);

    expect(
      architecture,
      "la arquitectura objetivo no se implementa por decreto: se migra incrementalmente",
    ).toMatch(/incremental|no es big-bang|big-bang/i);
  });

  it("las capacidades quedan clasificadas ACTIVE / FROZEN / LEGACY / FUTURE", () => {
    const architecture = reading(readRepoFile(ARCHITECTURE_DOC));

    const missingStatuses = CAPABILITY_STATUSES.filter(
      (status) =>
        !architecture.includes(status.code.toLowerCase()) ||
        !architecture.includes(reading(status.meaning)),
    ).map((status) => status.code);

    expect(
      missingStatuses,
      "cada estado tiene su significado escrito: sin eso, ACTIVE/FROZEN/LEGACY/FUTURE son cuatro etiquetas sin contrato",
    ).toEqual([]);

    const missingCapabilities = CAPABILITIES.filter(
      (capability) => !architecture.includes(reading(capability)),
    );

    expect(
      missingCapabilities,
      "cada capacidad fuera del MVP se clasifica explícitamente: es lo que evita reactivarla por accidente",
    ).toEqual([]);
  });

  it("las skills de UI mencionan el reuse audit, el viewport contract y el design freeze", () => {
    const uiSkills: Array<[string, string[]]> = [
      [".agents/skills/new-task/SKILL.md", ["REUSE AUDIT", "Design Freeze", "1366×768"]],
      [".agents/skills/screen-design/SKILL.md", ["reuse audit", "Design Freeze", "1366×768"]],
      [".agents/skills/ui-change/SKILL.md", ["reuse audit", "1366×768", "1280×720", "768×1024", "375×812"]],
      [TASK_TEMPLATE, ["REUSE AUDIT", "1366×768"]],
    ];

    const problems: string[] = [];

    for (const [doc, needles] of uiSkills) {
      const source = readRepoFile(doc);
      for (const needle of needles) {
        if (!source.includes(needle)) {
          problems.push(`${doc}: falta «${needle}»`);
        }
      }
    }

    expect(
      problems,
      "una TASK material de UI compara implementación real contra SPEC/reference antes de cerrar, y la QA operativa cubre los cuatro viewports",
    ).toEqual([]);
  });

  it("la arquitectura de producto sigue siendo una sola fuente y sin crecer como manual", () => {
    // El techo vive en `agent-system-contract.test.ts`; acá se custodia lo que esta TASK agregó:
    // que la arquitectura objetivo **no** haya venido acompañada de módulos nuevos en el código.
    expect(
      countMatches(readRepoFile(ARCHITECTURE_DOC), /^## /gm),
      "el documento sigue siendo una constitución: las secciones se cuentan para que no se convierta en un manual",
    ).toBeGreaterThan(5);
  });
});
