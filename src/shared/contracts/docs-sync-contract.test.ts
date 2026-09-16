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
 */

const AGENTS_DOC = "AGENTS.md";
const DESIGN_SYSTEM_DOC = "ops/references/stitch/design-system.md";

/**
 * Rutas del repo citadas entre backticks. Los globs (patrones con asterisco) quedan afuera a
 * propósito: un glob no es un archivo que deba existir.
 *
 * Se arma con `RegExp` y no como literal porque el delimitador es una tilde invertida y el parser de
 * Vite la confunde con el inicio de un template.
 */
const BACKTICK = String.fromCharCode(96);
const INLINE_REPO_PATH = new RegExp(
  `${BACKTICK}((?:ops|src|prisma|tests|scripts)[\\w./-]*\\/?)${BACKTICK}`,
  "g",
);

/** Links markdown internos: `[texto](ruta)`. Los externos y los anclas no se chequean. */
const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

function repoPathsCitedIn(doc: string): string[] {
  const cited = new Set<string>();

  for (const match of doc.matchAll(INLINE_REPO_PATH)) {
    if (/[./]/.test(match[1])) {
      cited.add(match[1]);
    }
  }

  for (const match of doc.matchAll(MARKDOWN_LINK)) {
    const target = match[1];
    if (target.startsWith("http") || target.startsWith("mailto:") || target.startsWith("#")) {
      continue;
    }
    cited.add(target.split("#")[0]);
  }

  return [...cited].sort();
}

describe("contrato · documentación sincronizada con el código", () => {
  it("AGENTS.md no referencia archivos que no existen", () => {
    const cited = repoPathsCitedIn(readRepoFile(AGENTS_DOC));

    expect(cited.length).toBeGreaterThan(5);

    const missing = cited.filter((repoPath) => !fileExists(repoPath));

    expect(
      missing,
      "corregí la ruta en AGENTS.md o el archivo que falta: un doc que apunta al vacío manda al próximo agente a buscar donde no hay",
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
