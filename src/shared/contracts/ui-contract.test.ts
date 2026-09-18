import { describe, expect, it } from "vitest";

import {
  countMatches,
  fileExists,
  listFiles,
  readRepoFile,
} from "./contract-files";

/**
 * TASK-204 — contrato de UI (`plna.md` §5, FASE 2).
 *
 * Qué garantiza, con el inventario medido en `ops/tasks/TASK-201-ui-inventory.md`:
 *
 * 1. **No crece el HTML crudo donde ya hay primitivo.** Hoy hay 96 controles crudos
 *    (`<button>`, `<input>`, `<select>`, `<textarea>`) repartidos en 32 archivos. No se refactorizan
 *    ahora (el plan §6 prohíbe tocar los archivos grandes por deporte), pero **no pueden crecer**: el
 *    número por archivo es un techo que solo baja. Cuando un archivo llega a 0, su fila se borra (el
 *    segundo test lo exige) y a partir de ahí la regla general lo cubre.
 * 2. **No se agregan colores sueltos.** `#hex` solo vive en la fuente de tokens (`globals.css`), en
 *    los archivos de **datos** de color (paletas, defaults, contraste: ahí el hex es el dato, no un
 *    estilo) y en las 6 filas legacy listadas abajo.
 * 3. **Todo componente de `_components/` está registrado en `src/shared/ui/registry.json`** (la
 *    regla de `AGENTS.md`: registro en el mismo commit, con su "cuándo NO usarlo"). El catálogo en
 *    markdown se retiró el 2026-09-16 con el sistema viejo: el registro es la fuente.
 *
 * Lo que este contrato **no** cubre todavía, para que no parezca cubierto: los 35 `rgba()`, las 70
 * clases de paleta cruda de Tailwind (`red-*`, `stone-*`, …) y los 29 `fontFamily` inline que
 * duplican `font-heading`. Están inventariados en TASK-201 y quedan como trabajo de la limpieza, no
 * como algo que este test vigile.
 */

const APP_ROOT = "src/app";

/** `<button `, `<input>`, `<select\n`, … Componentes (`<Button`) no entran: son otra cosa. */
const RAW_CONTROL = /<(button|input|select|textarea)(?=[\s>/])/g;

/**
 * Techos por archivo, medidos el 2026-09-14 (TASK-201, sección "HTML crudo").
 *
 * Regla de mantenimiento: **solo pueden bajar**. Si tocás un archivo y sacás controles crudos,
 * bajá el número en el mismo commit; si llega a 0, borrá la fila. No agregues filas nuevas: un
 * archivo nuevo tiene que usar los primitivos de `src/shared/ui/`.
 */
const LEGACY_RAW_CONTROLS: Record<string, number> = {
  "src/app/(admin)/admin/menu/categories/page.tsx": 9,
  "src/app/(admin)/admin/menu/marketing-blocks/page.tsx": 8,
  "src/app/(admin)/admin/menu/products/[id]/page.tsx": 8,
  "src/app/(public)/page.tsx": 5,
  // `locations/page.tsx` bajó a 0 en la Fase 2: la fila pasó a `location-row.tsx` con los primitivos
  // (`Button` + `Link`) y el formulario a `location-form-sheet.tsx`.
  "src/app/(public)/activity/page.tsx": 4,
  "src/app/(admin)/admin/inventory/receive/page.tsx": 3,
  "src/app/(admin)/admin/inventory/waste/page.tsx": 3,
  "src/app/(admin)/admin/locations/[id]/page.tsx": 3,
  "src/app/(admin)/admin/menu/modifier-groups/[id]/page.tsx": 3,
  "src/app/(admin)/admin/menu/products/page.tsx": 3,
  "src/app/(admin)/admin/_components/admin-mobile-nav.tsx": 3,
  "src/app/(public)/checkout/page.tsx": 3,
  "src/app/(public)/checkout/pickup-schedule-field.tsx": 3,
  "src/app/(public)/menu/page.tsx": 3,
  "src/app/(admin)/admin/orders/[id]/page.tsx": 2,
  "src/app/(admin)/admin/_components/admin-edit-sheet.tsx": 1,
  "src/app/(public)/menu/[productId]/page.tsx": 2,
  "src/app/(admin)/admin/delivery-zones/[id]/page.tsx": 1,
  "src/app/(admin)/admin/inventory/alerts/page.tsx": 1,
  "src/app/(admin)/admin/inventory/count/page.tsx": 1,
  "src/app/(admin)/admin/inventory/items/page.tsx": 1,
  "src/app/(admin)/admin/menu/products/product-dish-card.tsx": 1,
  // `order-actions.tsx` bajó a 0: su motivo de rechazo pasó al primitivo `Textarea` (Fase 2, KDS).
  "src/app/(admin)/admin/orders/order-comanda-board.tsx": 1,
  // Fila de lista multilínea de `/admin/promotions`: no es un botón de acción y `Button` no cubre su
  // anatomía (ver el comentario en la página y el registro de componentes). Es el único control crudo que
  // queda ahí tras TASK-206, que bajó el archivo de 6 a 1.
  "src/app/(admin)/admin/promotions/page.tsx": 1,
  "src/app/(public)/activity/order-history-views.tsx": 1,
  "src/app/(public)/menu/menu-product-card.tsx": 1,
};

const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;

/**
 * Archivos donde el `#hex` **es el dato**, no un estilo: la paleta que el owner elige en
 * `/admin/settings` y las herramientas que la validan. Mover un color de acá a la UI es el error que
 * este contrato evita.
 */
const HEX_IS_DATA = new Set([
  "src/modules/business-settings/domain/color-presets.ts",
  "src/modules/business-settings/domain/business-settings-defaults.ts",
  "src/modules/business-settings/domain/business-settings.schema.ts",
  "src/modules/business-settings/domain/color-contrast.ts",
  "src/modules/menu/domain/category-color.ts",
]);

/** La fuente de tokens: es el único lugar donde un color se declara como token. */
const HEX_TOKEN_SOURCE = "src/app/globals.css";

/**
 * `#hex` de UI que quedó del sistema viejo (TASK-201: 10 en total, 2 de ellos `#8aa060`, que no
 * sigue la apariencia configurada). Techo que solo baja; a 0 se borra la fila.
 */
const LEGACY_HEX: Record<string, number> = {
  "src/app/(landing)/landing/landing.css": 9,
  "src/app/(admin)/admin/menu/categories/page.tsx": 2,
  "src/app/(admin)/admin/inventory/receive/page.tsx": 1,
  "src/app/(public)/reservations/reservation-success-view.tsx": 1,
  "src/app/(public)/success/[orderId]/order-success-view.tsx": 1,
};

const REGISTRY_PATH = "src/shared/ui/registry.json";

function appComponentSources(): string[] {
  return listFiles(
    APP_ROOT,
    (repoPath) => repoPath.endsWith(".tsx") && !repoPath.endsWith(".test.tsx"),
  );
}

function styledSources(): string[] {
  return listFiles(
    "src",
    (repoPath) =>
      (repoPath.endsWith(".ts") || repoPath.endsWith(".tsx") || repoPath.endsWith(".css")) &&
      !repoPath.endsWith(".test.ts") &&
      !repoPath.endsWith(".test.tsx"),
  );
}

describe("contrato · UI (primitivos, tokens y registro de componentes)", () => {
  it("no agrega controles HTML crudos donde ya hay primitivo", () => {
    const offenders: string[] = [];

    for (const repoPath of appComponentSources()) {
      const count = countMatches(readRepoFile(repoPath), RAW_CONTROL);
      const ceiling = LEGACY_RAW_CONTROLS[repoPath] ?? 0;

      if (count > ceiling) {
        offenders.push(
          `${repoPath}: ${count} controles crudos (techo ${ceiling}). Usá el primitivo de src/shared/ui/`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("la lista de controles legacy sigue siendo real (a 0, la fila se borra)", () => {
    const stale = Object.keys(LEGACY_RAW_CONTROLS).filter(
      (repoPath) =>
        !fileExists(repoPath) || countMatches(readRepoFile(repoPath), RAW_CONTROL) === 0,
    );

    expect(stale).toEqual([]);
  });

  it("no agrega #hex fuera de la fuente de tokens, de los datos de color y del legacy medido", () => {
    const offenders: string[] = [];

    for (const repoPath of styledSources()) {
      if (repoPath === HEX_TOKEN_SOURCE || HEX_IS_DATA.has(repoPath)) {
        continue;
      }

      const count = countMatches(readRepoFile(repoPath), HEX_COLOR);
      const ceiling = LEGACY_HEX[repoPath] ?? 0;

      if (count > ceiling) {
        offenders.push(
          `${repoPath}: ${count} colores hex (techo ${ceiling}). Usá un token de globals.css`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("la lista de hex legacy sigue siendo real (a 0, la fila se borra)", () => {
    const stale = Object.keys(LEGACY_HEX).filter(
      (repoPath) => !fileExists(repoPath) || countMatches(readRepoFile(repoPath), HEX_COLOR) === 0,
    );

    expect(stale).toEqual([]);
  });

  it("todo componente de _components/ está registrado en registry.json", () => {
    expect(fileExists(REGISTRY_PATH), `falta ${REGISTRY_PATH}`).toBe(true);

    const registry = readRepoFile(REGISTRY_PATH);
    const components = listFiles(
      APP_ROOT,
      (repoPath) =>
        repoPath.includes("/_components/") &&
        repoPath.endsWith(".tsx") &&
        !repoPath.endsWith(".test.tsx"),
    );

    expect(components.length).toBeGreaterThan(0);

    const unregistered = components.filter((repoPath) => {
      const name = repoPath.split("/").pop()!.replace(/\.tsx$/, "");
      return !registry.includes(repoPath) && !registry.includes(name);
    });

    expect(
      unregistered,
      "registralos en src/shared/ui/registry.json (con su cuándo NO usarlos) en el mismo commit",
    ).toEqual([]);
  });
});