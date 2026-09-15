import { describe, expect, it } from "vitest";

import { countLines, fileExists, listFiles, readRepoFile } from "./contract-files";

/**
 * TASK-204 — contrato de route handlers (`plna.md` §5, FASE 2).
 *
 * `AGENTS.md` dice que un `route.ts` **solo orquesta**: valida, resuelve permisos, instancia el
 * adaptador y llama al caso de uso. Este contrato lo hace verificable con dos reglas y una lista de
 * excepciones medida, porque hoy la realidad está lejos de la regla: de **64** route handlers, **49**
 * pasan las 50 líneas y **3** instancian Prisma a mano.
 *
 * Por qué no se arreglan ahora: el plan §6 prohíbe refactorizar `api/admin/tables/**` y §4.1 fija el
 * tope para lo nuevo. Entonces la deuda queda **congelada**: los números de abajo son techos que solo
 * bajan (y a ≤50 líneas la fila se borra; el segundo test lo exige). Un route nuevo nace con el tope
 * real de 50 líneas y sin Prisma.
 */

/** Tope real para un route handler nuevo, en líneas (sin contar el `\n` final). */
const MAX_ROUTE_LINES = 50;

/**
 * Techos por archivo medidos el 2026-09-14 (49 route handlers de 64). Solo bajan. Cuando uno queda en
 * 50 o menos, su fila se borra y pasa a regir el tope general.
 */
const LEGACY_ROUTE_LINES: Record<string, number> = {
  "src/app/api/orders/route.ts": 201,
  "src/app/api/internal/outbox/process/route.ts": 155,
  "src/app/api/admin/orders/route.ts": 127,
  // TASK-308 bajó estas dos: el esquema del local (que estaba duplicado en las dos) se fue a
  // `locations/location-payload.ts`, así que las rutas quedaron en 56 y 71 líneas.
  "src/app/api/admin/locations/[id]/route.ts": 71,
  "src/app/api/admin/tables/route.ts": 123,
  "src/app/api/admin/menu/products/[id]/route.ts": 122,
  "src/app/api/admin/locations/route.ts": 56,
  "src/app/api/admin/menu/products/route.ts": 112,
  "src/app/api/admin/menu/marketing-blocks/route.ts": 111,
  "src/app/api/admin/orders/[id]/status/route.ts": 107,
  "src/app/api/admin/users/[id]/route.ts": 103,
  "src/app/api/internal/staging/persistent-admin/route.ts": 102,
  "src/app/api/admin/menu/marketing-blocks/[id]/route.ts": 100,
  "src/app/api/internal/staging/admin-qa/route.ts": 90,
  "src/app/api/admin/menu/modifier-groups/[id]/route.ts": 85,
  "src/app/api/admin/tables/[id]/route.ts": 84,
  "src/app/api/admin/menu/subcategories/[id]/route.ts": 82,
  "src/app/api/internal/staging/seed/route.ts": 82,
  "src/app/api/admin/promotions/[id]/route.ts": 81,
  "src/app/api/customer/auth/verify-otp/route.ts": 79,
  "src/app/api/admin/inventory/items/route.ts": 77,
  "src/app/api/admin/users/route.ts": 77,
  "src/app/api/admin/business-settings/route.ts": 76,
  "src/app/api/admin/delivery-zones/[id]/route.ts": 76,
  "src/app/api/admin/menu/modifier-groups/route.ts": 76,
  "src/app/api/admin/menu/categories/route.ts": 73,
  "src/app/api/admin/promotions/route.ts": 73,
  "src/app/api/admin/menu/subcategories/route.ts": 72,
  "src/app/api/auth/admin/login/route.ts": 72,
  "src/app/api/admin/locations/[id]/products/[productId]/route.ts": 69,
  "src/app/api/admin/delivery-zones/route.ts": 68,
  "src/app/api/orders/track/route.ts": 67,
  "src/app/api/admin/overview/performance/route.ts": 65,
  "src/app/api/admin/menu/categories/[id]/route.ts": 64,
  "src/app/api/coupons/validate/route.ts": 64,
  "src/app/api/admin/reservations/[id]/status/route.ts": 61,
  "src/app/api/admin/inventory/waste/route.ts": 60,
  "src/app/api/orders/[id]/items/route.ts": 60,
  "src/app/api/admin/inventory/counts/route.ts": 59,
  "src/app/api/admin/inventory/receive/route.ts": 59,
  "src/app/api/internal/staging/inventory-qa-cleanup/route.ts": 59,
  "src/app/api/internal/staging/seed-cleanup/route.ts": 59,
  "src/app/api/customer/auth/request-otp/route.ts": 58,
  "src/app/api/admin/inventory/movements/route.ts": 56,
  "src/app/api/admin/reports/daily/route.ts": 55,
  "src/app/api/admin/reports/inventory/route.ts": 55,
  "src/app/api/admin/orders/[id]/delivery-fee/route.ts": 54,
  "src/app/api/admin/activity/recent/route.ts": 53,
  "src/app/api/readiness/route.ts": 51,
};

const PRISMA_DIRECT = /getPrismaClient|@prisma\/client/;

/**
 * Las tres únicas excepciones a "el route no toca Prisma":
 *
 * - `api/admin/tables/**`: módulo fuera del MVP y **prohibido de refactorizar** por el plan (§6);
 *   su deuda está anotada en `ops/audit-backlog.md` ("api/admin/tables/** con Prisma directo").
 * - `api/readiness`: es el chequeo de salud; su trabajo **es** preguntarle a la base si responde
 *   (`SELECT 1`). Envolverlo en un puerto no agregaría nada y sí un adaptador más.
 */
const LEGACY_ROUTE_PRISMA = new Set([
  "src/app/api/admin/tables/route.ts",
  "src/app/api/admin/tables/[id]/route.ts",
  "src/app/api/readiness/route.ts",
]);

function routeHandlers(): string[] {
  return listFiles("src/app/api", (repoPath) => repoPath.endsWith("/route.ts"));
}

describe("contrato · route handlers (tamaño y acceso a datos)", () => {
  it("ningún route handler nuevo pasa las 50 líneas", () => {
    const offenders: string[] = [];

    for (const repoPath of routeHandlers()) {
      const lines = countLines(repoPath);
      const ceiling = LEGACY_ROUTE_LINES[repoPath] ?? MAX_ROUTE_LINES;

      if (lines > ceiling) {
        offenders.push(
          `${repoPath}: ${lines} líneas (techo ${ceiling}). El route solo orquesta; la lógica va a un caso de uso`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("la lista de routes legacy sigue siendo real (a 50 o menos, la fila se borra)", () => {
    const stale = Object.keys(LEGACY_ROUTE_LINES).filter(
      (repoPath) => !fileExists(repoPath) || countLines(repoPath) <= MAX_ROUTE_LINES,
    );

    expect(stale).toEqual([]);
  });

  it("ningún route handler instancia Prisma (fuera de las tres excepciones documentadas)", () => {
    const offenders = routeHandlers().filter(
      (repoPath) =>
        !LEGACY_ROUTE_PRISMA.has(repoPath) && PRISMA_DIRECT.test(readRepoFile(repoPath)),
    );

    expect(
      offenders,
      "el route tiene que llamar a un caso de uso con su adaptador inyectado",
    ).toEqual([]);
  });

  it("las excepciones de Prisma siguen existiendo y siguen necesitándolo", () => {
    const stale = [...LEGACY_ROUTE_PRISMA].filter(
      (repoPath) => !fileExists(repoPath) || !PRISMA_DIRECT.test(readRepoFile(repoPath)),
    );

    expect(stale).toEqual([]);
  });
});
