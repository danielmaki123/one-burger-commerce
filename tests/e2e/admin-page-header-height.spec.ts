import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * A-43 — **la cabecera del panel no pasa el 20% del alto** (`design-system.md` §8.4).
 *
 * El hallazgo decía «23,3% a 375 px» y estaba medido en Caja, pero el componente es de **todo** el panel:
 * a 375×800 las cinco pantallas con descripción de dos líneas y acción propia medían **186 px** (23,3%).
 * La regla es del sistema, así que se mide en el navegador de verdad —no en el HTML— sobre **todas** las
 * pantallas del panel, en los tres anchos del repo.
 *
 * Lo que este caso NO mide: la pantalla de **Personalización** (`/admin/settings`) porque no usa
 * `AdminPageHeader` (tiene su propia cabecera), que queda fuera del alcance de A-43; de ella se comprueba
 * que sigue en pie (título visible y sin scroll horizontal).
 */

type Pantalla = { nombre: string; ruta: string };

/** Las pantallas que usan el componente compartido. */
const PANTALLAS: Pantalla[] = [
  { nombre: "Caja", ruta: "/admin/cash" },
  { nombre: "POS", ruta: "/admin/pos" },
  { nombre: "Órdenes", ruta: "/admin/orders" },
  { nombre: "Cierres", ruta: "/admin/history/cierres" },
  { nombre: "Facturas", ruta: "/admin/history/facturas" },
  { nombre: "Aprobaciones", ruta: "/admin/approvals" },
  { nombre: "Config de Caja", ruta: "/admin/cash/config" },
  { nombre: "Locales", ruta: "/admin/locations" },
  { nombre: "Usuarios", ruta: "/admin/users" },
  { nombre: "Alertas (Settings)", ruta: "/admin/settings/notifications" },
  { nombre: "Menú", ruta: "/admin/menu" },
  { nombre: "Categorías", ruta: "/admin/menu/categories" },
  { nombre: "Productos", ruta: "/admin/menu/products" },
  { nombre: "Promociones", ruta: "/admin/promotions" },
];

/** Personalización: cabecera propia, fuera de A-43. Se comprueba que la pantalla siga en pie. */
const CABECERA_PROPIA: Pantalla = { nombre: "Personalización", ruta: "/admin/settings" };

const VIEWPORTS = [
  { width: 375, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
] as const;

/** El alto real de la cabecera: el `<section>` que envuelve al `h1` de la pantalla. */
async function altoDeLaCabecera(page: Page): Promise<number> {
  return page.evaluate(() => {
    const section = document.querySelector("h1")?.closest("section");
    return section ? section.getBoundingClientRect().height : -1;
  });
}

async function sinScrollHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`cabecera del panel a ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`ninguna pantalla pasa el 20% del alto (${viewport.width} px)`, async ({ page }) => {
      test.setTimeout(180_000);
      await loginAsOwner(page);

      const techo = viewport.height * 0.2;
      const medidas: string[] = [];

      for (const pantalla of PANTALLAS) {
        await page.goto(pantalla.ruta);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

        const alto = await altoDeLaCabecera(page);
        medidas.push(`${pantalla.nombre}: ${alto.toFixed(0)}px`);

        expect(
          alto,
          `${pantalla.nombre} (${pantalla.ruta}) mide ${alto.toFixed(0)}px a ${viewport.width} px de ancho: el techo es ${techo.toFixed(1)}px`,
        ).toBeLessThanOrEqual(techo);

        // La cabecera no puede achicarse a costa de romper la pantalla.
        expect(await sinScrollHorizontal(page), `${pantalla.nombre} desborda a lo ancho`).toBeLessThanOrEqual(1);
      }

      // Y la pantalla con cabecera propia sigue funcionando (no la toca este arreglo).
      await page.goto(CABECERA_PROPIA.ruta);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      expect(await sinScrollHorizontal(page)).toBeLessThanOrEqual(1);

      console.log(`\n${viewport.width}x${viewport.height} (techo ${techo.toFixed(1)}px)\n${medidas.join("\n")}`);
    });

    /**
     * La cabecera es contexto, no contenido: si se achica perdiendo piezas, el arreglo no sirve. En las
     * pantallas con acción (el enlace o botón de la cabecera) la acción sigue a la vista y con su mínimo
     * táctil de 44 px.
     */
    test(`las piezas de la cabecera siguen enteras (${viewport.width} px)`, async ({ page }) => {
      test.setTimeout(120_000);
      await loginAsOwner(page);

      const conAccion: Array<Pantalla & { accion: string }> = [
        { nombre: "Caja", ruta: "/admin/cash", accion: "Reporte del día" },
        { nombre: "Locales", ruta: "/admin/locations", accion: "Nuevo local" },
      ];

      for (const pantalla of conAccion) {
        await page.goto(pantalla.ruta);
        const cabecera = page
          .locator("section", { has: page.getByRole("heading", { level: 1 }) })
          .first();

        // Las tres piezas del componente: el título, la descripción y la acción.
        await expect(cabecera.getByRole("heading", { level: 1 })).toBeVisible();
        expect(
          await cabecera.locator("p").count(),
          `${pantalla.nombre}: la cabecera conserva su descripción`,
        ).toBeGreaterThanOrEqual(1);

        const accion = cabecera.getByRole("link", { name: pantalla.accion });
        const boton = cabecera.getByRole("button", { name: pantalla.accion });
        const visible = (await accion.count()) > 0 ? accion : boton;
        await expect(visible, `${pantalla.nombre}: la acción de la cabecera sigue`).toBeVisible();

        const caja = await visible.boundingBox();
        expect(caja!.height, `${pantalla.nombre}: la acción conserva el mínimo táctil`).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
