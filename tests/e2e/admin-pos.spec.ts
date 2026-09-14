import { expect, test } from "@playwright/test";

import {
  ADMIN_PASSWORD,
  createAdminUserViaUi,
  loginAsOwner,
  logoutAdmin,
  mutationsAllowed,
} from "./helpers";

/**
 * TASK-302 — el punto de venta.
 *
 * Lo que se mide de verdad en el navegador: que el catálogo del local llegue a la pantalla, que se
 * pueda armar la venta, que los controles táctiles midan lo que tienen que medir y que **todavía no
 * exista un cobro** (eso es TASK-303: un botón que no cobra es un control que miente).
 */

async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe("punto de venta", () => {
  test.describe("en celular", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("se arma la venta con el catálogo del local, sin scroll horizontal", async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/admin/pos");

      await expect(page.getByRole("heading", { name: "Punto de venta" })).toBeVisible();

      // El catálogo llega por la API del POS: se espera al primer producto vendible del seed.
      const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
      await expect(agregar).toBeVisible();

      const boton = await agregar.boundingBox();
      expect(boton!.height).toBeGreaterThanOrEqual(44);

      const venta = page.getByRole("region", { name: "Venta en curso" });
      await expect(venta.getByText("Agregá productos del catálogo para armar la venta.")).toBeVisible();

      await agregar.click();

      await expect(
        venta.getByText("Agregá productos del catálogo para armar la venta."),
      ).toBeHidden();
      // El subtotal sale del borrador y se muestra formateado con la moneda configurada.
      await expect(venta.locator("p[aria-live='polite']")).toContainText("C$");

      // TASK-303: el cobro todavía no existe.
      await expect(page.getByRole("button", { name: /cobrar/i })).toHaveCount(0);

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  });

  test.describe("en escritorio", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("el catálogo y la venta conviven en dos columnas", async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/admin/pos");

      const catalogo = page.getByRole("region", { name: "Catálogo" });
      const venta = page.getByRole("region", { name: "Venta en curso" });

      await expect(catalogo).toBeVisible();
      await expect(venta).toBeVisible();

      const cajaCatalogo = await catalogo.boundingBox();
      const cajaVenta = await venta.boundingBox();

      expect(cajaVenta!.x).toBeGreaterThan(cajaCatalogo!.x + cajaCatalogo!.width - 2);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  });

  test("cocina no entra al punto de venta (vuelve a comandas)", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    const email = `cocina-pos-${Date.now()}@example.com`;
    await createAdminUserViaUi(page, {
      name: "Cocina POS",
      email,
      password: ADMIN_PASSWORD,
      role: "kitchen",
    });

    await logoutAdmin(page);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);

    await page.goto("/admin/pos");
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });
});
