import { describe, expect, it } from "vitest";

import { fileExists, listFiles, readRepoFile } from "./contract-files";

/**
 * C0-3 de `plan2uiux.md` — el registro de componentes (`src/shared/ui/registry.json`).
 *
 * El catálogo humano sigue siendo `DESIGN_SYSTEM.md` §3 (así lo exige `ui-contract.test.ts`, que
 * rechaza cualquier componente de `_components/` sin fila ahí). Este archivo es su **espejo
 * declarado**: mismo inventario, con la metadata en un JSON que un agente o una herramienta puede
 * leer sin parsear markdown.
 *
 * Lo que garantiza, de la más fuerte a la más frágil:
 *
 * 1. **Forma**: la versión, las capas y los componentes están; cada fila tiene nombre, ruta, capa,
 *    tipo, estado, exports y **su "cuándo SÍ" y su "cuándo NO"** (los dos no vacíos: una fila sin
 *    criterio no sirve para decidir nada).
 * 2. **Los exports declarados existen** en el archivo declarado. Es la parte que se pudre primero.
 * 3. **Sin duplicados** por nombre y sin dos filas que digan ser el mismo export.
 * 4. **Toda ruta existe** (una fila que apunta al vacío manda al agente a buscar donde no hay).
 * 5. **Todo archivo de UI real está registrado**: cada `.tsx`/`.ts` de `src/shared/ui/` (sin tests) y
 *    cada `.tsx` de un `_components/` (sin tests) que exporte un componente tiene su fila. Un archivo
 *    nuevo sin registrar rompe el contrato, que es el objetivo del registro.
 */

const REGISTRY_PATH = "src/shared/ui/registry.json";

const SHARED_UI_DIR = "src/shared/ui/";

const LAYERS = ["shared", "admin", "public"] as const;
const KINDS = ["control", "surface", "display", "layout", "provider", "feedback"] as const;
const STATUSES = ["in-use", "orphan", "missing"] as const;

type ComponentEntry = {
  name: string;
  path: string;
  layer: string;
  kind: string;
  status: string;
  exports: string[];
  whenToUse: string;
  whenNotToUse: string;
};

type Registry = {
  version: number;
  updated: string;
  source_of_truth: string;
  catalog: string;
  layers: Record<string, string>;
  components: ComponentEntry[];
};

function loadRegistry(): Registry {
  expect(fileExists(REGISTRY_PATH), `falta ${REGISTRY_PATH}`).toBe(true);
  return JSON.parse(readRepoFile(REGISTRY_PATH)) as Registry;
}

/**
 * Nombres exportados con **firma de declaración**: `export function X`, `export default function X`,
 * `export const X =` y `export class X`. Quedan afuera los `export { X } from "..."` (reexports) a
 * propósito: acá se verifica que el archivo **declare** lo que el registro dice que exporta.
 */
const EXPORTED_DECLARATION =
  /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$]\w*)/g;

/** Los componentes empiezan con mayúscula; `useOrderTrackingSession` entra por su nombre declarado. */
function componentExports(source: string): string[] {
  const names = new Set<string>();

  for (const match of source.matchAll(EXPORTED_DECLARATION)) {
    names.add(match[1]);
  }

  return [...names];
}

function isTestFile(repoPath: string): boolean {
  return /\.test\.(ts|tsx)$/.test(repoPath);
}

/** Archivos que el registro debe cubrir: primitivos compartidos y componentes de `_components/`. */
function componentSources(): string[] {
  const shared = listFiles(
    "src/shared/ui",
    (repoPath) => /\.(ts|tsx)$/.test(repoPath) && !isTestFile(repoPath),
  );

  const app = listFiles(
    "src/app",
    (repoPath) =>
      repoPath.includes("/_components/") &&
      repoPath.endsWith(".tsx") &&
      !isTestFile(repoPath),
  );

  return [...shared, ...app].sort();
}

/** `admin-mobile-nav.tsx` → `adminmobilenav`: la ruta y el nombre se comparan sin separadores. */
function normalize(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function entryKey(repoPath: string): string {
  const file = repoPath.split("/").pop()!;
  return normalize(file);
}

/** Un archivo entra al inventario si exporta algún componente (no si solo tiene helpers). */
function sourceWithComponents(): string[] {
  return componentSources().filter((repoPath) =>
    componentExports(readRepoFile(repoPath)).length > 0,
  );
}

describe("contrato · registro de componentes (src/shared/ui/registry.json)", () => {
  it("tiene la forma declarada y cada fila trae su criterio", () => {
    const registry = loadRegistry();

    expect(registry.version).toBe(1);
    expect(registry.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(registry.source_of_truth).toBe("DESIGN_SYSTEM.md");
    expect(registry.catalog).toContain("DESIGN_SYSTEM.md");
    expect(Object.keys(registry.layers).sort()).toEqual([...LAYERS].sort());
    expect(registry.components.length).toBeGreaterThan(0);

    const offenders: string[] = [];

    for (const component of registry.components) {
      const label = component.name || "(sin nombre)";

      if (!component.name || !component.path) {
        offenders.push(`${label}: falta name o path`);
      }

      if (!LAYERS.includes(component.layer as (typeof LAYERS)[number])) {
        offenders.push(`${label}: layer "${component.layer}" no es una capa declarada`);
      }

      if (!KINDS.includes(component.kind as (typeof KINDS)[number])) {
        offenders.push(`${label}: kind "${component.kind}" no es un tipo declarado`);
      }

      if (!STATUSES.includes(component.status as (typeof STATUSES)[number])) {
        offenders.push(`${label}: status "${component.status}" no es un estado declarado`);
      }

      if (!Array.isArray(component.exports) || component.exports.length === 0) {
        offenders.push(`${label}: sin exports declarados`);
      }

      for (const field of ["whenToUse", "whenNotToUse"] as const) {
        if (!component[field] || component[field].trim().length < 10) {
          offenders.push(`${label}: ${field} vacío o demasiado corto para decidir`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("los exports declarados existen en el archivo declarado", () => {
    const offenders: string[] = [];

    for (const component of loadRegistry().components) {
      if (!fileExists(component.path)) {
        continue; // la ruta faltante la reporta el test que sigue, con su propio mensaje
      }

      const available = new Set(componentExports(readRepoFile(component.path)));

      for (const exported of component.exports) {
        if (!available.has(exported)) {
          offenders.push(
            `${component.name}: declara exportar "${exported}", que no está en ${component.path} (exporta: ${[...available].join(", ") || "ninguno"})`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("no repite componentes ni reasigna un export a dos filas", () => {
    const components = loadRegistry().components;

    const duplicateNames = components
      .map((component) => component.name)
      .filter((name, index, all) => all.indexOf(name) !== index);

    const exportOwners = new Map<string, string[]>();
    for (const component of components) {
      for (const exported of component.exports) {
        exportOwners.set(exported, [...(exportOwners.get(exported) ?? []), component.name]);
      }
    }

    const reassigned = [...exportOwners.entries()]
      .filter(([, owners]) => owners.length > 1)
      .map(([exported, owners]) => `${exported}: ${owners.join(", ")}`);

    expect(duplicateNames, "nombres repetidos").toEqual([]);
    expect(reassigned, "un export no puede pertenecer a dos componentes distintos").toEqual([]);
  });

  it("toda ruta registrada existe en el repo", () => {
    const missing = loadRegistry()
      .components.map((component) => component.path)
      .filter((repoPath) => !fileExists(repoPath));

    expect(missing, "una fila que apunta al vacío manda al próximo agente a buscar donde no hay").toEqual(
      [],
    );
  });

  it("todo archivo de UI que exporta un componente está registrado", () => {
    const registry = loadRegistry();
    const registeredPaths = new Set(registry.components.map((component) => normalize(component.path)));
    const registeredNames = new Set(registry.components.map((component) => normalize(component.name)));

    const unregistered = sourceWithComponents().filter(
      (repoPath) =>
        !registeredPaths.has(normalize(repoPath)) && !registeredNames.has(entryKey(repoPath)),
    );

    expect(
      unregistered,
      "registralos en src/shared/ui/registry.json y en DESIGN_SYSTEM.md §3 en el mismo commit",
    ).toEqual([]);
  });

  it("las filas de shared viven en src/shared/ui/", () => {
    const offenders = loadRegistry()
      .components.filter(
        (component) => component.layer === "shared" && !component.path.startsWith(SHARED_UI_DIR),
      )
      .map((component) => `${component.name}: ${component.path}`);

    expect(offenders).toEqual([]);
  });
});
