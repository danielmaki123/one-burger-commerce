import { expect, test } from "@playwright/test";

import { flattenMenuProducts, readPublicMenu, seedCartWithProduct } from "./helpers";

/**
 * El smoke de producción: **solo lectura**, sin `E2E_ALLOW_MUTATIONS`. Verifica que el sitio real
 * responde, que el login del panel está, y las superficies de T8 (locales, menú por local y el
 * control de retiro del checkout). Los dominios y sus redirecciones los cubre
 * `production-hosts.spec.ts` (`npm run test:e2e:prod:hosts`).
 *
 * El catálogo se lee de `/api/menu` (helpers compartidos): el smoke no puede depender del seed
 * local, que en producción no existe.
 */

test.describe("production smoke", () => {
  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("one-burger-commerce");
  });

  test("readiness endpoint confirms database connectivity", async ({ request }) => {
    const response = await request.get("/api/readiness");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(payload.status).toBe("ready");
    expect(payload.checks.database.status).toBe("ok");
  });

  test("public MVP routes are reachable and reservation flow redirects to menu", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar en el menú")).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Carrito" })).toBeVisible();

    await page.goto("/checkout");
    await expect(page.getByText(/Tu carrito está vacío|Confirmá tu pedido/)).toBeVisible();

    await page.goto("/reservations");
    await expect(page).toHaveURL(/\/menu$/);
  });

  test("admin login is reachable and branded", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByText("Acceso administrativo de One Burger")).toBeVisible();
  });

  /**
   * T8 en producción: los locales públicos salen con los datos del punto de retiro y **sin** el
   * contacto interno del local (teléfono y WhatsApp no son del cliente).
   */
  test("los locales públicos traen el punto de retiro y nada interno", async ({ request }) => {
    const response = await request.get("/api/locations");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);

    for (const location of payload.data) {
      expect(location.id).toBeTruthy();
      expect(location.name).toBeTruthy();
      expect(location.businessHours).toBeTruthy();
      expect(typeof location.pickupLeadMinutes).toBe("number");
      expect(typeof location.isAcceptingOrders).toBe("boolean");
      expect(location.phone).toBeUndefined();
      expect(location.whatsapp).toBeUndefined();
    }
  });

  /** Fase 5 de T8: el menú público también responde cotizado para un local concreto. */
  test("el menú se puede pedir cotizado por local", async ({ request }) => {
    const locations = await (await request.get("/api/locations")).json();
    const locationId = locations.data[0].id as string;

    const general = await (await request.get("/api/menu")).json();
    const byLocation = await request.get(`/api/menu?locationId=${encodeURIComponent(locationId)}`);

    expect(byLocation.ok()).toBe(true);
    const scoped = await byLocation.json();

    expect(scoped.categories.length).toBe(general.categories.length);
    expect(flattenMenuProducts(scoped.categories).map((product) => product.id)).toEqual(
      flattenMenuProducts(general.categories).map((product) => product.id),
    );
  });

  /**
   * El callejón sin salida que se arregló el 2026-09-12: con el local **cerrado** (antes de las 12
   * o después de las 22) el checkout escondía el control de retiro, así que el cliente no podía
   * programar para otro día. Acá se comprueba que el control y el selector de día están, a
   * cualquier hora. Es solo lectura: el carrito se arma en el navegador y no se confirma nada.
   */
  test("el checkout deja elegir día de retiro aunque el local esté cerrado ahora", async ({
    page,
    request,
  }) => {
    const menu = await readPublicMenu(request);
    const product = menu.products[0];
    expect(product, "el catálogo tiene que tener al menos un producto").toBeTruthy();

    await seedCartWithProduct(page, product);
    await page.goto("/checkout");

    const schedule = page.getByRole("button", { name: /^Retiro/ });
    await expect(schedule).toBeVisible();

    await schedule.click();
    await expect(page.getByLabel("Día de retiro")).toBeVisible();
    // Siempre hay algo que elegir: "lo antes posible" y/o los turnos del día.
    await expect(page.locator('input[name="pickupTimeOption"]')).not.toHaveCount(0);
  });
});
