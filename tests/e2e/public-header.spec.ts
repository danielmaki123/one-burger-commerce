import { expect, test, type Page } from "@playwright/test";

/**
 * A-08 — la marca (isotipo + nombre) en el header.
 *
 * El owner reportó que a 375 px la marca desaparecía: `getPublicHeaderClassName()` devolvía
 * `hidden … md:block`, así que el header entero quedaba fuera de pantalla en celular. Lo que se
 * mide acá es lo que pidió: que el isotipo y el nombre se vean en las **secciones principales**,
 * en los dos anchos que exige el repo.
 *
 * El nombre no se hardcodea: se lee del manifiesto, que lo genera desde la configuración del
 * negocio. Y el enlace se busca por su **nombre accesible completo** (`<nombre> inicio`) con
 * `exact: true`: si el isotipo aportara texto al nombre accesible, la búsqueda no lo encontraría.
 */

/** El manifiesto público se genera desde `/admin/settings`: ahí viaja el nombre del negocio. */
async function readBusinessName(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    const manifest = (await res.json()) as { name?: string };

    return manifest.name ?? "";
  });
}

/** Secciones principales donde la marca tiene que estar. */
const MAIN_SECTIONS = ["/", "/menu", "/cart"];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("la marca en el header (A-08)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el isotipo y el nombre se ven en celular en las secciones principales (375 px)", async ({
    page,
  }) => {
    for (const path of MAIN_SECTIONS) {
      await page.goto(path);

      const name = await readBusinessName(page);
      expect(name.length, "el negocio tiene que tener un nombre configurado").toBeGreaterThan(0);

      const brand = page.getByRole("link", { name: `${name} inicio`, exact: true });
      await expect(brand, `la marca tiene que verse en ${path}`).toBeVisible();
      await expect(brand).toContainText(name);

      // El isotipo configurado o, si todavía no hay logo, las iniciales: nunca un hueco.
      const mark = brand.locator("img, span").first();
      await expect(mark, `el isotipo tiene que verse en ${path}`).toBeVisible();

      // Y el isotipo no aporta texto al lector de pantalla: el nombre ya lo anuncia el enlace.
      await expect(mark).toHaveAttribute("aria-hidden", "true");

      expect(await horizontalOverflow(page), `sin scroll horizontal en ${path}`).toBeLessThanOrEqual(
        1,
      );
    }
  });
});

test.describe("la marca en el header en escritorio (A-08)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("la marca sigue a la vista en las secciones principales (1280 px)", async ({ page }) => {
    for (const path of ["/", "/menu"]) {
      await page.goto(path);

      const name = await readBusinessName(page);
      const brand = page.getByRole("link", { name: `${name} inicio`, exact: true });
      await expect(brand, `la marca tiene que verse en ${path}`).toBeVisible();

      // La marca vive arriba y a la izquierda: el isotipo y el nombre, en la misma fila.
      const box = await brand.boundingBox();
      expect(box, `la marca tiene que tener caja real en ${path}`).not.toBeNull();
      expect(box!.y, `la marca tiene que quedar arriba en ${path}`).toBeLessThan(120);

      expect(await horizontalOverflow(page), `sin scroll horizontal en ${path}`).toBeLessThanOrEqual(
        1,
      );
    }
  });
});
