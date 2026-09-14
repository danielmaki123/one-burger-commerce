import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Utilidades para los tests de contrato de `src/shared/contracts/`.
 *
 * Viven en un solo archivo a propósito: cada guardrail recorre el repo y lee archivos, y si cada
 * test trajera su propio `walk` habría cinco versiones de la misma función (que es justo lo que el
 * design system prohíbe: ver `AGENTS.md` → "Antes de crear, buscar").
 *
 * Ningún archivo de este directorio se importa desde la app: los únicos consumidores son los tests.
 */

/** Raíz del repo, calculada desde la ubicación de este archivo (`src/shared/contracts`). */
export const repoRoot = path.resolve(__dirname, "../../..");

/** Directorios que nunca se recorren: pesan y no tienen código propio. */
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "playwright-report",
  "test-results",
]);

function toRepoPath(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

/**
 * Devuelve rutas relativas a la raíz (con `/`, no `\`) de todos los archivos bajo `relativeDir`,
 * ordenadas alfabéticamente para que los mensajes de fallo sean estables entre corridas.
 */
export function listFiles(
  relativeDir: string,
  matches?: (repoPath: string) => boolean,
): string[] {
  const found: string[] = [];

  const walk = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          walk(path.join(absoluteDir, entry.name));
        }
        continue;
      }

      const repoPath = toRepoPath(path.join(absoluteDir, entry.name));
      if (!matches || matches(repoPath)) {
        found.push(repoPath);
      }
    }
  };

  walk(path.join(repoRoot, relativeDir));

  return found.sort();
}

export function readRepoFile(repoPath: string): string {
  return readFileSync(path.join(repoRoot, repoPath), "utf8");
}

/**
 * Líneas reales de un archivo: la última línea vacía (el `\n` final) no cuenta. Sin esto, un archivo
 * de 50 líneas mediría 51 y el tope del contrato sería mentira.
 */
export function countLines(repoPath: string): number {
  return readRepoFile(repoPath).replace(/\n$/, "").split("\n").length;
}

export function fileExists(repoPath: string): boolean {
  return statSync(path.join(repoRoot, repoPath), { throwIfNoEntry: false }) !== undefined;
}

export function countMatches(source: string, pattern: RegExp): number {
  return (source.match(pattern) ?? []).length;
}

/** Directorios de un módulo (`src/modules/<módulo>` → `["adapters", "domain", ...]`). */
export function listModuleDirectories(moduleName: string): string[] {
  return readdirSync(path.join(repoRoot, "src", "modules", moduleName), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
