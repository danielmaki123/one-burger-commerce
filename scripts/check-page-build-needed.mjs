import { appendFileSync, readFileSync } from "node:fs";

/**
 * TASK-AUD-002 — ¿hay que correr `build:webpack` en esta corrida?
 *
 * El build de Turbopack **no valida los exports de una página** (los `page.tsx` bajo `src/app`): el error
 * aparece recién al servir la página. La regla existía sólo en prosa, así que dependía de que alguien se
 * acordara de correr el build extra antes de cerrar la TASK.
 *
 * Este script sólo **decide** (no construye): recibe la lista de archivos cambiados y contesta
 * `needed=true|false`. El workflow lo llama dentro del job `verify` —que ya es un check requerido— y corre
 * `npm run build:webpack` únicamente cuando la respuesta es `true`. Así no se crea un required check
 * condicional, que en una PR sin páginas quedaría para siempre en «Expected».
 *
 * Uso: `node scripts/check-page-build-needed.mjs <archivo-con-la-lista-de-cambios>`
 */

/** Una página del App Router: `src/app/page.tsx` o cualquier `page.tsx` más profundo. */
const PAGE_PATTERN = /^src\/app\/(?:.+\/)?page\.tsx$/;

const USAGE = "uso: node scripts/check-page-build-needed.mjs <archivo-con-la-lista-de-cambios>";

/** Filtra las páginas del App Router de una lista de rutas cambiadas (las devuelve en orden y sin repetir). */
export function pageFilesIn(files) {
  return [...new Set(files)].filter((file) => PAGE_PATTERN.test(file));
}

function main() {
  const listPath = process.argv[2];

  if (!listPath) {
    console.error(USAGE);
    process.exit(2);
  }

  let raw;

  try {
    raw = readFileSync(listPath, "utf8");
  } catch (error) {
    console.error(`no se pudo leer la lista de cambios (${listPath}): ${error.message}`);
    console.error(USAGE);
    process.exit(2);
  }

  const files = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const pages = pageFilesIn(files);
  const needed = pages.length > 0;

  console.log(`needed=${needed}`);

  if (needed) {
    console.log("estas páginas obligan a correr `npm run build:webpack`:");
    for (const page of pages) {
      console.log(`  - ${page}`);
    }
  } else {
    console.log("ninguna página cambió: el build de Turbopack del job alcanza");
  }

  // Salida para el workflow: `steps.<id>.outputs.needed`.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `needed=${needed}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `pages=${pages.length}\n`);
  }
}

// Sólo corre cuando se lo invoca como script: importarlo (para los tests) no ejecuta nada.
if (process.argv[1] && process.argv[1].endsWith("check-page-build-needed.mjs")) {
  main();
}
