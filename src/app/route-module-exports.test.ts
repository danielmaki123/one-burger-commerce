import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Contrato de los módulos de ruta.
 *
 * `next build --webpack` **falla** si un `page.tsx` / `layout.tsx` / `route.ts` exporta
 * algo que Next no conoce: genera un tipo por módulo que exige que solo salgan
 * `default`, `metadata`, los métodos HTTP y la configuración de segmento. Con
 * Turbopack (el build que usa el deploy) esa validación no corría, así que el problema
 * vivía escondido: un componente exportado desde una página rompía el otro build.
 *
 * Este test lo agarra en segundos, sin esperar a que alguien corra el `--webpack`.
 */

const APP_DIR = join(process.cwd(), "src", "app");

/** Lo que Next sí acepta que exporte un módulo de ruta. */
const ALLOWED_EXPORTS = new Set([
  // Página / layout
  "default",
  "metadata",
  "generateMetadata",
  "viewport",
  "generateViewport",
  "generateStaticParams",
  "generateImageMetadata",
  // Configuración de segmento
  "revalidate",
  "dynamic",
  "dynamicParams",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
  "experimental_ppr",
  "alt",
  "size",
  "contentType",
  // Handlers HTTP de route.ts
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

/** `metadata` y compañía se declaran una sola vez por archivo. */
const ROUTE_MODULE_NAMES = new Set(["page.tsx", "layout.tsx", "route.ts", "default.tsx"]);

function collectRouteModules(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      found.push(...collectRouteModules(path));
    } else if (ROUTE_MODULE_NAMES.has(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

function exportedNames(source: string): string[] {
  const names = new Set<string>();

  // `export function x`, `export const x`, `export async function x`, `export type x`…
  for (const match of source.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/gm,
  )) {
    names.add(match[1]);
  }

  // `export { a, b as c }` y `export type { … }`.
  for (const match of source.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const part of match[1].split(",")) {
      const alias = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (alias) names.add(alias);
    }
  }

  return [...names];
}

describe("módulos de ruta", () => {
  const modules = collectRouteModules(APP_DIR);

  it("encuentra las páginas, layouts y rutas del proyecto", () => {
    expect(modules.length).toBeGreaterThan(40);
  });

  it("no exporta nada más que lo que Next conoce", () => {
    const offenders: string[] = [];

    for (const modulePath of modules) {
      const extra = exportedNames(readFileSync(modulePath, "utf8")).filter(
        (name) => !ALLOWED_EXPORTS.has(name),
      );

      if (extra.length > 0) {
        offenders.push(`${modulePath.replace(process.cwd(), "")} → ${extra.join(", ")}`);
      }
    }

    // Si aparece algo acá, movelo a un módulo hermano (`*-helpers.ts`, `*-views.tsx`):
    // un `page.tsx` exportando componentes rompe `next build --webpack`.
    expect(offenders).toEqual([]);
  });
});
