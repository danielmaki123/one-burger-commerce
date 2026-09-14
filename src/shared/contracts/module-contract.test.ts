import { describe, expect, it } from "vitest";

import { listFiles, readRepoFile } from "./contract-files";

/**
 * TASK-204 — contrato de módulos (`plna.md` §5, FASE 2).
 *
 * Dos reglas de `AGENTS.md`, hechas verificables:
 *
 * 1. Un módulo nuevo nace con las cuatro capas (`domain/features/ports/adapters`). Los módulos que
 *    hoy no las tienen quedan **congelados** como excepción documentada; si alguno se completa, su
 *    fila se borra (el segundo test lo exige).
 * 2. `domain/` no conoce el mundo de afuera: no importa `app/`, `adapters/`, `infrastructure/` ni
 *    `@prisma/client`. Hoy se cumple en el 100 % de los archivos de dominio, así que esta regla no
 *    necesita lista de excepciones.
 *
 * **Una capa cuenta solo si tiene archivos.** La primera versión miraba si el directorio existía, y
 * el CI la desmintió: `coupons` y `table-ordering` tienen `adapters/domain/features/ports` **vacíos**
 * en mi disco (y en el de cualquiera que los haya creado), pero git no versiona carpetas vacías, así
 * que en un clon esos módulos son solo un `README.md`. Medir directorios hacía que el mismo código
 * pasara acá y fallara en CI.
 */

const REQUIRED_MODULE_DIRECTORIES = ["adapters", "domain", "features", "ports"];

/**
 * Los módulos que no tienen las cuatro capas **con archivos**, con su motivo. Congelados: no se
 * completan "por deporte" (plan §6), pero tampoco crecen hacia otros lados.
 */
const LEGACY_PARTIAL_MODULES: Record<string, string> = {
  dashboard:
    "solo domain y features: sus casos de uso reciben repositorios de otros módulos (orders, menu, inventory), así que no define puertos ni adaptadores propios",
  landing:
    "solo domain: es la secuencia de frames del landing y su matemática de scroll, sin I/O ni casos de uso",
  tables:
    "solo lib: bootstrap heredado de otro proyecto (Casa Antigua). El plan §6 prohíbe refactorizar api/admin/tables/**",
  coupons:
    "cascarón: solo README.md, sin una línea de código. El motor de cupones vive en src/modules/orders/domain/promo-bogo.ts y sus casos de uso en src/modules/orders/features. Decisión del owner: borrar el cascarón o completarlo (A-13 del backlog)",
  "table-ordering":
    "cascarón: solo README.md, sin una línea de código (el bootstrap de mesas está en src/modules/tables/lib). Decisión del owner: borrar el cascarón o completarlo (A-13 del backlog)",
};

/** Un `domain/` que importa esto dejó de ser dominio. */
const FORBIDDEN_DOMAIN_IMPORT =
  /from\s+"(?:@\/(?:app|infrastructure)\/|@prisma\/client|@\/modules\/[^"]*\/adapters\/|(?:\.\.\/)+adapters\/)/;

/** Capas del módulo que tienen al menos un archivo (no alcanza con que exista la carpeta). */
function layersWithFiles(moduleName: string): string[] {
  return REQUIRED_MODULE_DIRECTORIES.filter(
    (layer) => listFiles(`src/modules/${moduleName}/${layer}`).length > 0,
  );
}

function domainSources(): string[] {
  return listFiles(
    "src/modules",
    (repoPath) =>
      repoPath.includes("/domain/") && repoPath.endsWith(".ts") && !repoPath.endsWith(".test.ts"),
  );
}

describe("contrato · módulos (capas y dirección de las dependencias)", () => {
  it("todo módulo nuevo tiene domain, features, ports y adapters", () => {
    // Se derivan de las capas existentes: cualquier carpeta de primer nivel bajo src/modules con
    // archivos adentro es un módulo.
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

      const layers = layersWithFiles(moduleName);
      const missing = REQUIRED_MODULE_DIRECTORIES.filter((layer) => !layers.includes(layer));

      if (missing.length > 0) {
        incomplete.push(`${moduleName}: falta ${missing.join(", ")}`);
      }
    }

    expect(
      incomplete,
      "un módulo nuevo necesita las cuatro capas; si de verdad es solo dominio (o un cascarón), agregalo a LEGACY_PARTIAL_MODULES con el motivo",
    ).toEqual([]);
  });

  it("las excepciones de módulos siguen siendo reales (completo, la fila se borra)", () => {
    const stale = Object.entries(LEGACY_PARTIAL_MODULES)
      .filter(([moduleName]) =>
        REQUIRED_MODULE_DIRECTORIES.every((layer) => layersWithFiles(moduleName).includes(layer)),
      )
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
