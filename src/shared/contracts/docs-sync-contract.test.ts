import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fileExists, readRepoFile, repoRoot } from "./contract-files";

/**
 * Contrato de sincronización de documentos.
 *
 * **Cambió el contrato (2026-09-16).** Antes custodiaba dos cosas más que hoy no tienen sujeto:
 *
 * 1. **El frontmatter de `DESIGN_SYSTEM.md`** (`source_of_truth:`, `tokens_file:`, `inventory:`): ese
 *    catálogo se borró cuando el owner declaró a `ops/references/stitch/design-system.md` como el
 *    sistema oficial.
 * 2. **La frescura por git** («si cambió `prisma/schema.prisma` o `src/shared/ui/`, el catálogo se tocó
 *    ese día»): el documento nuevo es **del owner**, no del repo, así que exigirle que se modifique
 *    cuando cambia el esquema sería pedirle a un archivo de diseño que siga al código. Esa parte del
 *    guardrail sigue viva, pero en el lugar donde el repo sí escribe: `AGENTS.md` y `globals.css`, que
 *    los verifica `stitch-system-contract.test.ts`.
 *
 * Lo que queda es lo que no depende de qué sistema esté de moda: **ningún documento del repo puede
 * apuntar a un archivo que no existe**. Es lo que evitó que `AGENTS.md` mandara meses a una sección
 * inexistente.
 *
 * **Se amplió (2026-09-24, TASK-AUD-000).** Con la reorganización, `.agents/` y los documentos del
 * agente pasaron a ser el **camino de entrada** de una sesión nueva: un documento que manda al vacío
 * desorienta al próximo agente en el primer minuto. Así que ahora se recorren también esos documentos,
 * se reconoce el prefijo `.agents` y los links markdown se resuelven **relativos al documento que los
 * cita** (antes solo se miraban los backticks, que van relativos a la raíz).
 */

const AGENTS_DOC = "AGENTS.md";
const DESIGN_SYSTEM_DOC = "ops/references/stitch/design-system.md";

/** El procedimiento por tipo de trabajo: son los documentos con más links cruzados del repo. */
const SKILL_NAMES = [
  "new-task",
  "bugfix",
  "money-change",
  "database-migration",
  "security-change",
  "ui-change",
  "audit",
  "production-release",
] as const;

/** Los documentos que forman el camino de entrada del agente. */
const AGENT_DOCS: string[] = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/README.md",
  ".agents/CONTEXT.md",
  ".agents/MEMORY.md",
  "ops/CURRENT.md",
  "ops/tasks/START-HERE.md",
  "ops/tasks/TEMPLATE.md",
  "ops/tasks/AUDIT-REMEDIATION-ROADMAP.md",
  "ops/decisions/ADR-000-agent-operating-system.md",
  // ARCH-001: la arquitectura de producto se consulta **antes** de crear una capacidad nueva, así que
  // sus propias referencias también tienen que poder seguirse.
  "ops/product/MODULE_ARCHITECTURE.md",
  ...SKILL_NAMES.map((skill) => `.agents/skills/${skill}/SKILL.md`),
];

/**
 * Rutas del repo citadas entre backticks. Los globs (patrones con asterisco) y las plantillas
 * (`<pantalla>`) quedan afuera solos: el carácter que no es `\w`, `.`, `/` o `-` corta el match antes
 * de la tilde de cierre, así que no hay falso positivo que arreglar.
 *
 * Se arma con `RegExp` y no como literal porque el delimitador es una tilde invertida y el parser de
 * Vite la confunde con el inicio de un template.
 */
const BACKTICK = String.fromCharCode(96);
const INLINE_REPO_PATH = new RegExp(
  `${BACKTICK}((?:\\.agents|ops|src|prisma|tests|scripts)[\\w./-]*\\/?)${BACKTICK}`,
  "g",
);

/** Links markdown internos: `[texto](ruta)`. Los externos y los anclas no se chequean. */
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

/**
 * Resuelve un link relativo al documento que lo cita. Devuelve `null` para lo externo, los anclas y lo
 * que se sale del repo (`../..`): un link a otra cosa no es una ruta del repo que deba existir.
 */
function resolveRelativeLink(docPath: string, target: string): string | null {
  if (target.startsWith("http") || target.startsWith("mailto:") || target.startsWith("#")) {
    return null;
  }

  const withoutAnchor = target.split("#")[0];
  if (withoutAnchor.length === 0) {
    return null;
  }

  const resolved = path.posix.normalize(
    path.posix.join(path.posix.dirname(docPath), withoutAnchor),
  );

  return resolved.startsWith("..") ? null : resolved;
}

function repoPathsCitedIn(docPath: string): string[] {
  const doc = readRepoFile(docPath);
  const cited = new Set<string>();

  // Backticks: rutas relativas a la raíz del repo.
  for (const match of doc.matchAll(INLINE_REPO_PATH)) {
    if (/[./]/.test(match[1])) {
      cited.add(match[1]);
    }
  }

  // Links markdown: relativos al documento.
  for (const match of doc.matchAll(MARKDOWN_LINK)) {
    const resolved = resolveRelativeLink(docPath, match[1]);
    if (resolved !== null) {
      cited.add(resolved);
    }
  }

  return [...cited].sort();
}

describe("contrato · documentación sincronizada con el código", () => {
  it("AGENTS.md no referencia archivos que no existen", () => {
    const cited = repoPathsCitedIn(AGENTS_DOC);

    expect(cited.length).toBeGreaterThan(5);

    const missing = cited.filter((repoPath) => !fileExists(repoPath));

    expect(
      missing,
      "corregí la ruta en AGENTS.md o el archivo que falta: un doc que apunta al vacío manda al próximo agente a buscar donde no hay",
    ).toEqual([]);
  });

  it("los documentos del sistema del agente no referencian archivos que no existen", () => {
    const problems: string[] = [];

    for (const doc of AGENT_DOCS) {
      if (!fileExists(doc)) {
        problems.push(`${doc}: no existe`);
        continue;
      }

      for (const repoPath of repoPathsCitedIn(doc)) {
        if (!fileExists(repoPath)) {
          problems.push(`${doc} → ${repoPath}`);
        }
      }
    }

    expect(
      problems,
      "el camino de entrada del agente tiene que poder seguirse entero: arreglá la ruta o creá el archivo",
    ).toEqual([]);
  });

  it("el sistema de diseño oficial existe y AGENTS.md lo cita", () => {
    expect(fileExists(DESIGN_SYSTEM_DOC), `falta ${DESIGN_SYSTEM_DOC}`).toBe(true);
    expect(readRepoFile(AGENTS_DOC), "AGENTS.md tiene que apuntar al sistema vigente").toContain(
      DESIGN_SYSTEM_DOC,
    );
  });

  it("el repo se puede leer sin la historia de git (contratos deterministas)", () => {
    // El guardrail viejo usaba `git log` y se saltaba en un clon superficial: un contrato que a veces
    // no corre es un contrato que no existe. Los que quedan leen archivos y nada más.
    expect(existsSync(path.join(repoRoot, "package.json"))).toBe(true);
  });
});
