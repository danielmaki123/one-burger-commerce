import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fileExists, readRepoFile, repoRoot } from "./contract-files";

/**
 * TASK-204 — contrato de sincronización de documentos (`plna.md` §5, FASE 2).
 *
 * Tres guardas, de la más fuerte a la más frágil:
 *
 * 1. **`AGENTS.md` no puede referenciar archivos que no existen** (links markdown y rutas entre
 *    backticks). Es determinista: si un archivo se renombra y el doc no, CI lo dice.
 * 2. **`DESIGN_SYSTEM.md` declara de dónde sale** (frontmatter) y esos archivos existen.
 * 3. **Frescura por git**: si cambió `prisma/schema.prisma` o `src/shared/ui/`, `DESIGN_SYSTEM.md`
 *    tiene que haberse tocado después. Se salta (reportado como *skipped*, no en silencio) cuando la
 *    historia de git no alcanza: un clon superficial (`fetch-depth: 1`) no puede saber cuándo se tocó
 *    cada archivo. El job `contracts` de CI hace checkout completo justamente para que corra de verdad.
 */

const AGENTS_DOC = "AGENTS.md";
const DESIGN_SYSTEM_DOC = "DESIGN_SYSTEM.md";

/**
 * Rutas del repo citadas entre backticks. Los globs (patrones con asterisco) quedan afuera a
 * propósito: un glob no es un archivo que deba existir.
 *
 * Se arma con `RegExp` y no como literal porque el delimitador es una tilde invertida y el parser de
 * Vite la confunde con el inicio de un template.
 */
const BACKTICK = String.fromCharCode(96);
const INLINE_REPO_PATH = new RegExp(
  `${BACKTICK}((?:ops|src|prisma|tests|scripts|DESIGN_SYSTEM\\.md|README\\.md|package\\.json|AGENTS\\.md)[\\w./-]*\\/?)${BACKTICK}`,
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

function lastCommitEpoch(repoPath: string): number | null {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", repoPath], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    return out ? Number(out) : null;
  } catch {
    return null;
  }
}

/** Sin `.git` (por ejemplo, una copia sin historia) la guarda de frescura no puede correr. */
const hasGitDirectory = existsSync(path.join(repoRoot, ".git"));

const designSystemEpoch = hasGitDirectory ? lastCommitEpoch(DESIGN_SYSTEM_DOC) : null;
const schemaEpoch = hasGitDirectory ? lastCommitEpoch("prisma/schema.prisma") : null;
const sharedUiEpoch = hasGitDirectory ? lastCommitEpoch("src/shared/ui") : null;
const canCheckFreshness =
  designSystemEpoch !== null && (schemaEpoch !== null || sharedUiEpoch !== null);

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

  it("DESIGN_SYSTEM.md declara su origen y esos archivos existen", () => {
    expect(fileExists(DESIGN_SYSTEM_DOC), `falta ${DESIGN_SYSTEM_DOC}`).toBe(true);

    const designSystem = readRepoFile(DESIGN_SYSTEM_DOC);

    for (const key of ["source_of_truth", "tokens_file", "inventory"]) {
      expect(designSystem, `falta ${key} en el frontmatter`).toMatch(
        new RegExp(`^${key}:\\s*\\S`, "m"),
      );
    }

    const declared = [...designSystem.matchAll(/^(?:source_of_truth|tokens_file|inventory):\s*(\S+)/gm)]
      .map((match) => match[1])
      .filter((value) => value !== "AGENTS.md" && value !== DESIGN_SYSTEM_DOC);

    expect(declared.length).toBeGreaterThan(0);

    const missing = declared.filter((repoPath) => !fileExists(repoPath));
    expect(missing).toEqual([]);
  });

  it.skipIf(!canCheckFreshness)(
    "si cambió el esquema o src/shared/ui, DESIGN_SYSTEM.md se tocó después",
    () => {
      const stale: string[] = [];

      if (schemaEpoch !== null && schemaEpoch > designSystemEpoch!) {
        stale.push("prisma/schema.prisma");
      }

      if (sharedUiEpoch !== null && sharedUiEpoch > designSystemEpoch!) {
        stale.push("src/shared/ui/");
      }

      expect(
        stale,
        `cambió ${stale.join(" y ")} sin tocar ${DESIGN_SYSTEM_DOC}: actualizá el design system (y su frontmatter updated:) en el mismo commit`,
      ).toEqual([]);
    },
  );
});
