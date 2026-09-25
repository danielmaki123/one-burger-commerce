import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readRepoFile, repoRoot } from "./contract-files";

/**
 * TASK-AUD-002 — gate de `build:webpack` para páginas.
 *
 * El repo sabe desde hace tiempo que el build de Turbopack **no valida los exports de una página** (los
 * `page.tsx` bajo `src/app`): el problema aparece recién en producción. La regla existía sólo en prosa
 * (`AGENTS.md` § *Validación*), así que dependía de que alguien se acordara de correr el build extra.
 *
 * Acá se fija la **lógica de detección** (qué archivos obligan a correrlo) ejecutando el script real, y se
 * exige que el workflow lo tenga conectado dentro de un check **ya requerido** (`verify`) en vez de crear un
 * required check condicional, que en un PR sin páginas quedaría eternamente en «Expected».
 */

const SCRIPT = "scripts/check-page-build-needed.mjs";
const WORKFLOW = ".github/workflows/publish-ghcr.yml";

/** Corre el script de detección contra una lista de archivos y devuelve su salida. */
function runGate(files: readonly string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), "page-gate-"));
  const listPath = path.join(dir, "changed.txt");

  writeFileSync(listPath, files.length > 0 ? `${files.join("\n")}\n` : "", "utf8");

  return execFileSync("node", [path.join(repoRoot, SCRIPT), listPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function saysNeeded(files: readonly string[]): boolean {
  return /^needed=true$/m.test(runGate(files));
}

describe("gate de build:webpack · lógica de detección", () => {
  it("pide el build cuando cambia una página del panel", () => {
    expect(saysNeeded(["src/app/(admin)/admin/cash/page.tsx"])).toBe(true);
  });

  it("pide el build cuando cambia una página pública", () => {
    expect(saysNeeded(["src/app/(public)/menu/[productId]/page.tsx"])).toBe(true);
  });

  it("pide el build si hay una página entre muchos archivos que no lo son", () => {
    expect(
      saysNeeded([
        "src/modules/orders/domain/order.ts",
        "README.md",
        "src/app/(public)/checkout/page.tsx",
        "src/shared/lib/order-totals.ts",
      ]),
    ).toBe(true);
  });

  it("NO pide el build si no hay ninguna página", () => {
    expect(
      saysNeeded([
        "src/modules/orders/domain/order.ts",
        "src/app/api/orders/route.ts",
        "tests/e2e/public-menu.spec.ts",
        ".github/workflows/publish-ghcr.yml",
      ]),
    ).toBe(false);
  });

  it("NO confunde un componente ni un layout con una página", () => {
    expect(
      saysNeeded([
        "src/app/(admin)/admin/_components/panel.tsx",
        "src/app/(admin)/admin/layout.tsx",
        "src/app/(admin)/admin/loading.tsx",
        "src/app/globals.css",
      ]),
    ).toBe(false);
  });

  it("NO se dispara con una ruta que sólo se llama parecido", () => {
    expect(saysNeeded(["src/app/(admin)/admin/pages/page.tsx.bak", "docs/page.tsx.md"])).toBe(false);
  });

  it("con la lista vacía no pide el build", () => {
    expect(saysNeeded([])).toBe(false);
  });

  it("dice qué archivos lo dispararon", () => {
    const output = runGate(["src/app/(public)/cart/page.tsx", "src/app/(admin)/admin/page.tsx"]);

    expect(output).toContain("src/app/(public)/cart/page.tsx");
    expect(output).toContain("src/app/(admin)/admin/page.tsx");
  });

  it("documenta su uso si se lo llama mal", () => {
    let message = "";

    try {
      execFileSync("node", [path.join(repoRoot, SCRIPT)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      message = String((error as { stderr?: string }).stderr ?? "");
    }

    expect(message).toMatch(/uso|usage/i);
  });

  /**
   * El acoplamiento más peligroso: el workflow lee `steps.page-changes.outputs.needed`, que existe **sólo**
   * si el script escribe en `$GITHUB_OUTPUT`. Si eso se rompe, el step del build de webpack **nunca** corre y
   * el gate queda apagado sin que nadie lo note.
   */
  it("publica la decisión en GITHUB_OUTPUT, que es lo que el workflow lee", () => {
    const decide = (files: readonly string[]): string => {
      const dir = mkdtempSync(path.join(tmpdir(), "page-gate-out-"));
      const listPath = path.join(dir, "changed.txt");
      const outputPath = path.join(dir, "github-output.txt");

      writeFileSync(listPath, files.length > 0 ? `${files.join("\n")}\n` : "", "utf8");
      writeFileSync(outputPath, "", "utf8");

      execFileSync("node", [path.join(repoRoot, SCRIPT), listPath], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GITHUB_OUTPUT: outputPath },
      });

      return readFileSync(outputPath, "utf8");
    };

    expect(decide(["src/app/(public)/menu/page.tsx"])).toContain("needed=true");
    expect(decide(["src/modules/orders/domain/order.ts"])).toContain("needed=false");
  });
});

describe("gate de build:webpack · conexión en el CI", () => {
  it("corre dentro del job `verify`, que ya es un check requerido", () => {
    const workflow = readRepoFile(WORKFLOW);
    const start = workflow.indexOf("\n  verify:");
    const end = workflow.indexOf("\n  contracts:");

    expect(start, "el workflow tiene que tener el job `verify`").toBeGreaterThan(-1);

    const verifyJob = workflow.slice(start, end === -1 ? undefined : end);

    expect(verifyJob, "el job verify tiene que llamar al detector").toContain(
      "scripts/check-page-build-needed.mjs",
    );
    expect(verifyJob, "el detector tiene que correr con el build de webpack").toContain(
      "npm run build:webpack",
    );
    expect(
      verifyJob,
      "el build tiene que ser condicional al detector, no correr siempre (ni nunca)",
    ).toMatch(/if:\s*steps\.\S+\.outputs\.needed\s*==\s*'true'/);
  });

  it("el detector tiene la historia que necesita para comparar en un PR", () => {
    const workflow = readRepoFile(WORKFLOW);
    const start = workflow.indexOf("\n  verify:");
    const end = workflow.indexOf("\n  contracts:");
    const verifyJob = workflow.slice(start, end === -1 ? undefined : end);

    expect(
      verifyJob,
      "sin `fetch-depth: 0` el diff contra la base del PR no se puede calcular y el gate se saltearía",
    ).toContain("fetch-depth: 0");
  });
});
