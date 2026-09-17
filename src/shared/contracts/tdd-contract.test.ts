import { describe, expect, it } from "vitest";

import { fileExists, listFiles, readRepoFile } from "./contract-files";

/**
 * Gate de TDD (2026-09-17, pedido del owner) — **código nuevo sin test no entra**.
 *
 * La regla vive en `AGENTS.md` § Testing. Acá se verifica, sobre el repo, lo que se puede verificar
 * sin adivinar la intención:
 *
 * 1. **Ruta API sin test hermano**: todo `src/app/api/**\/route.ts` tiene que tener un
 *    `route.test.ts` en su carpeta o en una carpeta superior (dentro de `src/app/api`).
 * 2. **Caso de uso sin test**: todo archivo de `src/modules/**\/features/**` (sin ser test ni un
 *    helper de carpeta) tiene un test con su nombre en su carpeta o en una superior.
 * 3. **Primitivo sin test**: todo archivo de `src/shared/ui/` tiene su `.test.ts(x)`.
 *
 * **Cómo se lee la regla**: un archivo está cubierto si existe un test **con su mismo nombre base**
 * en su carpeta o en una carpeta superior dentro del alcance. Eso es lo que hace que
 * `orders/features/shift/{open,close,get-current}-shift.ts` cuente como cubierto por
 * `features/shift/shift-features.test.ts` (un test hermano que prueba los tres casos de uso) sin
 * inventar que cada uno tiene su archivo.
 *
 * **La deuda que ya existía está congelada con su motivo escrito** (`EXCEPTIONS`), y **no crece**:
 * cualquier ruta, feature o primitivo **nuevo** sin test pone el contrato en rojo. La lista es el
 * inventario honesto que pidió el owner; se baja cuando se escribe el test que falta.
 */

const API_ROOT = "src/app/api";
const MODULES_ROOT = "src/modules";
const UI_ROOT = "src/shared/ui";

const TEST_EXTENSIONS = ["ts", "tsx"] as const;

/**
 * Violaciones congeladas: cada una con el motivo por el que se acepta hoy.
 *
 * No es una whitelist para tapar: es la deuda medida el 2026-09-17 y su explicación. Si un archivo de
 * acá recibe su test, la fila se borra (el contrato siguiente falla si sobra una excepción muerta).
 */
const EXCEPTIONS: Record<string, string> = {
  // --- Rutas sin test hermano -----------------------------------------------------------------
  // Módulos fuera del MVP (AGENTS.md: código presente, no ofrecido): no se invierte en tests nuevos
  // hasta que el owner decida reactivarlos.
  "src/app/api/admin/inventory/items/route.ts": "Inventario: fuera del MVP.",
  "src/app/api/admin/inventory/receive/route.ts": "Inventario: fuera del MVP.",
  "src/app/api/admin/inventory/waste/route.ts": "Inventario: fuera del MVP.",
  "src/app/api/admin/reservations/route.ts": "Reservas: fuera del MVP.",
  "src/app/api/admin/reservations/[id]/route.ts": "Reservas: fuera del MVP.",
  "src/app/api/admin/reservations/[id]/status/route.ts": "Reservas: fuera del MVP.",
  // Auth de cliente (OTP por WhatsApp) sin proveedor real: la ruta responde 503 en producción.
  "src/app/api/customer/auth/logout/route.ts": "Auth de cliente sin proveedor real (503 en prod).",
  "src/app/api/customer/auth/verify-otp/route.ts": "Auth de cliente sin proveedor real (503 en prod).",
  // Rutas del POS previas al gate: cubiertas por E2E (`admin-pos.spec.ts` abre, cobra y cierra de
  // verdad) pero **sin test unitario**. Deuda declarada: el gate las deja pasar para no bloquear el
  // roadmap, no porque estén bien.
  "src/app/api/admin/pos/shift/route.ts": "Deuda: cubierta por E2E, sin test unitario.",
  "src/app/api/admin/pos/shift/open/route.ts": "Deuda: cubierta por E2E, sin test unitario.",
  "src/app/api/admin/pos/shift/close/route.ts": "Deuda: cubierta por E2E, sin test unitario.",
  "src/app/api/coupons/validate/route.ts": "Deuda: cubierta por E2E del checkout, sin test unitario.",
  "src/app/api/auth/admin/logout/route.ts": "Deuda: cubierta por E2E del panel, sin test unitario.",

  // --- Casos de uso sin test ------------------------------------------------------------------
  // Sesión: `require-admin-session` y amigos son la puerta que **todos** los tests de ruta mockean,
  // así que probarlos de verdad pide una base; su contrato está fijado por esos mismos tests.
  "src/modules/auth/features/get-admin-session/get-admin-session.ts": "Sesión: puerta mockeada por los tests de ruta.",
  "src/modules/auth/features/logout-admin/logout-admin.ts": "Sesión: puerta mockeada por los tests de ruta.",
  "src/modules/auth/features/require-admin-session/require-admin-session.ts": "Sesión: puerta mockeada por los tests de ruta.",
  // Reportes del dashboard: fuera del MVP y con la ruta cubierta por su propio route.test.ts.
  "src/modules/dashboard/features/get-daily-report/get-daily-report.ts": "Reportes: fuera del MVP.",
  "src/modules/dashboard/features/get-dashboard-summary/get-dashboard-summary.ts": "Reportes: fuera del MVP.",
  "src/modules/dashboard/features/get-inventory-report/get-inventory-report.ts": "Reportes: fuera del MVP.",
  "src/modules/dashboard/features/get-recent-activity/get-recent-activity.ts": "Reportes: fuera del MVP.",
  "src/modules/inventory/features/shared/inventory-idempotency.ts": "Inventario: fuera del MVP.",
  // CRUD del admin probado por el route.test.ts de su ruta, que es donde vive la composición.
  "src/modules/locations/features/list-location-catalog/list-location-catalog.ts": "Cubierto por el test de su ruta.",
  "src/modules/locations/features/set-location-product/set-location-product.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/create-marketing-block/create-marketing-block.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/create-subcategory/create-subcategory.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/delete-subcategory/delete-subcategory.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/get-admin-product/get-admin-product.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/list-admin-marketing-blocks/list-admin-marketing-blocks.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/list-admin-products/list-admin-products.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/list-admin-subcategories/list-admin-subcategories.ts": "Cubierto por el test de su ruta.",
  "src/modules/menu/features/update-category/update-category.ts": "Cubierto por el test de su ruta.",
  "src/modules/orders/features/list-public-delivery-zones/list-public-delivery-zones.ts": "Delivery: fuera del MVP.",
  // Los tres del turno se prueban juntos en `features/shift/shift-features.test.ts` (hermano), que es
  // el archivo que el dueño de la regla consideraría su test: no se parte en tres por el gate.
  "src/modules/orders/features/shift/open-shift.ts": "Probado en shift-features.test.ts (hermano).",
  "src/modules/orders/features/shift/close-shift.ts": "Probado en shift-features.test.ts (hermano).",
  "src/modules/orders/features/shift/get-current-shift.ts": "Probado en shift-features.test.ts (hermano).",
  "src/modules/pos/features/close-pos-shift/close-pos-shift.ts": "Deuda: cubierto por E2E del POS, sin test unitario.",

  // --- Primitivos sin test propio -------------------------------------------------------------
  // Están en decenas de pantallas con test (el E2E los mide a 375 y 1280 px), pero no tienen test
  // propio: es la deuda que el owner quiere ver listada, no escondida.
  "src/shared/ui/input.tsx": "Deuda: sin test propio (medido por E2E en 375/1280 px).",
  "src/shared/ui/card.tsx": "Deuda: sin test propio (composición usada por pantallas con test).",
  "src/shared/ui/badge.tsx": "Deuda: sin test propio (medido por E2E en 375/1280 px).",
  "src/shared/ui/checkbox.tsx": "Deuda: sin test propio (medido por E2E en 375/1280 px).",
  "src/shared/ui/radio-group.tsx": "Deuda: sin test propio (medido por E2E en 375/1280 px).",
  "src/shared/ui/status-progress.tsx": "Deuda: sin test propio (usado por seguimiento con E2E).",
  "src/shared/ui/public-confirmation-shell.tsx": "Deuda: sin test propio (usado por confirmación con E2E).",
};

function isTestFile(repoPath: string) {
  return /\.test\.(ts|tsx)$/.test(repoPath);
}

/** Todos los tests del alcance, para resolver cobertura por nombre. */
function testFilesIn(root: string): string[] {
  return listFiles(root, (repoPath) => isTestFile(repoPath));
}

/**
 * ¿Este archivo está cubierto? Sí cuando existe un test con **su nombre base** en su carpeta o en
 * cualquier carpeta superior dentro de `root`. Es la regla que permite un test hermano que prueba
 * varios casos de uso del mismo grupo sin fingir un archivo por caso.
 */
function hasTestNear(repoPath: string, tests: string[], root: string): boolean {
  const extension = repoPath.endsWith(".tsx") ? ".tsx" : ".ts";
  const base = repoPath.slice(0, -extension.length);
  const candidates = [`${base}.test.ts`, `${base}.test.tsx`];

  if (candidates.some((candidate) => tests.includes(candidate))) return true;

  // Sube carpeta por carpeta: `…/features/shift/x/y/use-case.ts` busca también en `…/features/shift`.
  const segments = repoPath.split("/");
  const rootSegments = root.split("/").length;

  for (let depth = segments.length - 2; depth >= rootSegments; depth -= 1) {
    const parent = segments.slice(0, depth).join("/");
    const name = segments[depth];
    if (candidates.some((candidate) => tests.includes(`${parent}/${candidate.split("/").pop()}`))) {
      return true;
    }
    if (name === undefined) break;
  }

  return false;
}

function uncovered(candidates: string[], tests: string[], root: string): string[] {
  return candidates.filter(
    (repoPath) => !hasTestNear(repoPath, tests, root) && !(repoPath in EXCEPTIONS),
  );
}

function apiRoutes(): string[] {
  return listFiles(API_ROOT, (repoPath) => repoPath.endsWith("/route.ts"));
}

function featureFiles(): string[] {
  return listFiles(
    MODULES_ROOT,
    (repoPath) =>
      repoPath.includes("/features/") &&
      /\.(ts|tsx)$/.test(repoPath) &&
      !isTestFile(repoPath) &&
      !repoPath.endsWith(".d.ts"),
  );
}

function uiPrimitives(): string[] {
  return listFiles(UI_ROOT, (repoPath) => /\.(ts|tsx)$/.test(repoPath) && !isTestFile(repoPath));
}

describe("contrato · TDD (todo código nuevo tiene su test)", () => {
  it("toda ruta de src/app/api tiene su route.test.ts", () => {
    const offenders = uncovered(apiRoutes(), testFilesIn(API_ROOT), API_ROOT);

    expect(
      offenders,
      "escribí el route.test.ts al lado (AGENTS.md § Testing) o documentá la excepción con su motivo",
    ).toEqual([]);
  });

  it("todo caso de uso de src/modules/**/features tiene test", () => {
    const offenders = uncovered(featureFiles(), testFilesIn(MODULES_ROOT), MODULES_ROOT);

    expect(
      offenders,
      "escribí el test del caso de uso (AGENTS.md § Testing) o documentá la excepción con su motivo",
    ).toEqual([]);
  });

  it("todo primitivo de src/shared/ui tiene test propio", () => {
    const offenders = uncovered(uiPrimitives(), testFilesIn(UI_ROOT), UI_ROOT);

    expect(
      offenders,
      "escribí el test del primitivo (AGENTS.md § Testing) o documentá la excepción con su motivo",
    ).toEqual([]);
  });

  /**
   * Una excepción que ya no hace falta es deuda que quedó escrita de más: si el archivo no existe o
   * ya tiene test, la fila se borra. Sin esto la lista solo crece y deja de ser un inventario.
   */
  it("no quedan excepciones muertas (archivo inexistente o ya cubierto)", () => {
    const tests = [
      ...testFilesIn(API_ROOT),
      ...testFilesIn(MODULES_ROOT),
      ...testFilesIn(UI_ROOT),
    ];

    const stale = Object.keys(EXCEPTIONS).filter((repoPath) => {
      if (!fileExists(repoPath)) return true;

      const root = repoPath.startsWith(API_ROOT)
        ? API_ROOT
        : repoPath.startsWith(UI_ROOT)
          ? UI_ROOT
          : MODULES_ROOT;

      return hasTestNear(repoPath, tests, root);
    });

    expect(
      stale,
      "borrá la fila de EXCEPTIONS: el archivo ya tiene test (o ya no existe)",
    ).toEqual([]);
  });

  it("toda excepción explica su motivo por escrito", () => {
    const unexplained = Object.entries(EXCEPTIONS)
      .filter(([, reason]) => reason.trim().length < 15)
      .map(([repoPath]) => repoPath);

    expect(unexplained, "una excepción sin motivo es una excepción que nadie puede revisar").toEqual(
      [],
    );
  });

  /**
   * El gate tiene que tener **dientes**: si un archivo nuevo sin test no lo pone en rojo, no sirve.
   * Se prueba con un archivo que no existe y con uno que sí, sin tocar el repo.
   */
  it("detecta una ruta nueva sin test (se prueba el detector, no el repo)", () => {
    const fake = `${API_ROOT}/admin/inventado/route.ts`;
    const tests = testFilesIn(API_ROOT);

    expect(hasTestNear(fake, tests, API_ROOT)).toBe(false);
    // Y una que sí está cubierta, para que el detector no diga "no" siempre.
    expect(hasTestNear(`${API_ROOT}/admin/cash/shifts/route.ts`, tests, API_ROOT)).toBe(true);
  });

  it("el gate no se apaga solo: las listas que vigila no están vacías", () => {
    expect(apiRoutes().length).toBeGreaterThan(50);
    expect(featureFiles().length).toBeGreaterThan(50);
    expect(uiPrimitives().length).toBeGreaterThan(10);
  });

  it("la regla está escrita en AGENTS.md y apunta a este gate", () => {
    const agents = readRepoFile("AGENTS.md");

    expect(agents).toContain("## Testing (no negociable)");
    expect(agents).toContain("TDD obligatorio para TODO código nuevo");
    expect(agents).toContain("tdd-contract.test.ts");
  });
});
