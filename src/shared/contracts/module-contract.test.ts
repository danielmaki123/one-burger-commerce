import { describe, expect, it } from "vitest";

import { listFiles, listModuleDirectories, readRepoFile } from "./contract-files";

/**
 * TASK-204 — contrato de módulos (`plna.md` §5, FASE 2).
 *
 * Dos reglas de `AGENTS.md`, hechas verificables:
 *
 * 1. Un módulo nuevo nace con las cuatro capas (`domain/features/ports/adapters`). Tres módulos
 *    viejos no las tienen y quedan **congelados** como excepción documentada; si alguno se completa,
 *    su fila se borra (el segundo test lo exige).
 * 2. `domain/` no conoce el mundo de afuera: no importa `app/`, `adapters/`, `infrastructure/` ni
 *    `@prisma/client`. Hoy se cumple en los 100 % de los archivos de dominio, así que esta regla no
 *    necesita lista de excepciones.
 */

const REQUIRED_MODULE_DIRECTORIES = ["adapters", "domain", "features", "ports"];

/**
 * Los tres módulos que no tienen las cuatro capas, con su motivo. Congelados: no se completan "por
 * deporte" (plan §6), pero tampoco crecen hacia otros lados.
 */
const LEGACY_PARTIAL_MODULES: Record<string, string> = {
  dashboard:
    "solo domain y features: sus casos de uso reciben repositorios de otros módulos (orders, menu, inventory), así que no define puertos ni adaptadores propios",
  landing:
    "solo domain: es la secuencia de frames del landing y su matemática de scroll, sin I/O ni casos de uso",
  tables:
    "solo lib: bootstrap heredado de otro proyecto (Casa Antigua). El plan §6 prohíbe refactorizar api/admin/tables/**",
};

/** Un `domain/` que importa esto dejó de ser dominio. */
const FORBIDDEN_DOMAIN_IMPORT =
  /from\s+"(?:@\/(?:app|infrastructure)\/|@prisma\/client|@\/modules\/[^"]*\/adapters\/|(?:\.\.\/)+adapters\/)/;

function domainSources(): string[] {
  return listFiles(
    "src/modules",
    (repoPath) =>
      repoPath.includes("/domain/") && repoPath.endsWith(".ts") && !repoPath.endsWith(".test.ts"),
  );
}

describe("contrato · módulos (capas y dirección de las dependencias)", () => {
  it("todo módulo nuevo tiene domain, features, ports y adapters", () => {
    // Se derivan de las capas existentes: cualquier carpeta de primer nivel bajo src/modules que
    // contenga al menos una capa reconocida es un módulo.
    const modules = new Set<string>();
    for (const repoPath of listFiles("src/modules")) {
      const match = repoPath.match(/^src\/modules\/([^/]+)\//);
      if (match) {
        modules.add(match[1]);
      }
    }

    expect(modules.size).toBeGreaterThan(10);

    const incomplete: string[] = [];
    for (const moduleName of [...modules].sort()) {
      if (moduleName in LEGACY_PARTIAL_MODULES) {
        continue;
      }

      const directories = listModuleDirectories(moduleName);
      const missing = REQUIRED_MODULE_DIRECTORIES.filter((dir) => !directories.includes(dir));

      if (missing.length > 0) {
        incomplete.push(`${moduleName}: falta ${missing.join(", ")}`);
      }
    }

    expect(
      incomplete,
      "un módulo nuevo necesita las cuatro capas; si de verdad es solo dominio, agregalo a LEGACY_PARTIAL_MODULES con el motivo",
    ).toEqual([]);
  });

  it("las excepciones de módulos siguen siendo reales (completo, la fila se borra)", () => {
    const stale = Object.entries(LEGACY_PARTIAL_MODULES)
      .filter(([moduleName]) => {
        const directories = listModuleDirectories(moduleName);
        return REQUIRED_MODULE_DIRECTORIES.every((dir) => directories.includes(dir));
      })
      .map(([moduleName]) => moduleName);

    expect(stale).toEqual([]);
  });

  it("domain/ no importa app/, adapters/, infrastructure/ ni Prisma", () => {
    const offenders = domainSources()
      .filter((repoPath) => FORBIDDEN_DOMAIN_IMPORT.test(readRepoFile(repoPath)))
      .map((repoPath) => repoPath);

    expect(offenders).toEqual([]);
  });

  it("el dominio medido no está vacío (el contrato no pasa por no mirar nada)", () => {
    expect(domainSources().length).toBeGreaterThan(50);
  });
});
