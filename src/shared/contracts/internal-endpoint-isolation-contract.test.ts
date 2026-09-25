import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TASK-AUD-008 — **aislamiento de los endpoints internos y de staging**.
 *
 * Los endpoints de `/api/internal/**` no son para clientes: el de staging crea administradores y corre
 * seeds, y el del outbox procesa la cola de notificaciones. La única frontera que los separa de internet es
 * el **entorno** (`APP_ENV`), así que tienen que ser **fail-closed**:
 *
 * - toda ruta de `/api/internal/staging/**` comprueba `APP_ENV === "staging"` antes de hacer nada (en
 *   producción responde 403, y si la variable faltara también, porque la comparación no se cumple);
 * - toda ruta de `/api/internal/**` exige un secreto de entorno comparado con `timingSafeEqual` (nunca
 *   `===`, que filtra por tiempo).
 *
 * Este contrato lo verifica sobre **todas** las rutas, así una ruta interna nueva no puede nacer sin su
 * puerta: es el guardrail que convierte una propiedad verificada hoy en una regla permanente.
 */

const INTERNAL_ROOT = path.join(process.cwd(), "src", "app", "api", "internal");

function routeFiles(directory: string): string[] {
  let entries: string[];

  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const full = path.join(directory, entry);

    if (statSync(full).isDirectory()) return routeFiles(full);

    return entry === "route.ts" ? [full] : [];
  });
}

const routes = routeFiles(INTERNAL_ROOT).map((file) => ({
  file,
  relative: path.relative(process.cwd(), file).replace(/\\/g, "/"),
  source: readFileSync(file, "utf8"),
}));

describe("contrato · los endpoints internos están aislados por entorno y por secreto", () => {
  it("encuentra las rutas internas (no pasa por no mirar nada)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(6);
  });

  it("toda ruta de staging comprueba APP_ENV === 'staging' antes de hacer nada", () => {
    const staging = routes.filter((route) => route.relative.includes("/internal/staging/"));

    expect(staging.length).toBeGreaterThanOrEqual(5);

    for (const route of staging) {
      expect(
        route.source.includes('process.env.APP_ENV !== "staging"'),
        `${route.relative}: no cierra por entorno (un APP_ENV distinto de staging la dejaría alcanzable)`,
      ).toBe(true);
      expect(
        route.source.includes('"Staging only endpoint"'),
        `${route.relative}: no responde 403 con el motivo cuando el entorno no corresponde`,
      ).toBe(true);
    }
  });

  it("toda ruta interna exige un secreto comparado con timingSafeEqual", () => {
    for (const route of routes) {
      expect(
        route.source.includes("timingSafeEqual"),
        `${route.relative}: no compara su secreto con timingSafeEqual (una comparación con === filtra por tiempo)`,
      ).toBe(true);
    }
  });

  it("el secreto del outbox no puede quedar vacío: sin secreto la ruta se cierra, no se abre", () => {
    const outbox = routes.find((route) => route.relative.includes("/internal/outbox/process/route.ts"));

    expect(outbox, "no se encontró la ruta del procesador del outbox").toBeDefined();
    expect(
      /!expectedToken/.test(outbox!.source),
      "la ruta del outbox tiene que rechazar cuando el secreto del entorno falta (fail-closed)",
    ).toBe(true);
  });
});
