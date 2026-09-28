import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * `TASK-ORDERS-KITCHEN-RUNTIME-002` — la superficie de **Cocina** (`/admin/kitchen`), en un navegador real.
 *
 * Lo que los tests de jsdom no pueden ver: que la **página no scrollee** y el scroll viva en cada carril
 * (el Viewport Contract de una superficie operativa), que el conmutador aparezca donde tiene que aparecer,
 * y —lo más importante— que la cocina **no vea un solo importe**.
 *
 * Muta datos: solo con `E2E_ALLOW_MUTATIONS=true`, nunca contra producción.
 *
 * Reemplaza a `admin-comandas.spec.ts`: el modo cocina de `/admin/orders` **ya no existe** —es lo que esta
 * TASK separa—, así que su spec se movió con la superficie.
 */
test.describe("Cocina: el tablero propio (TASK-ORDERS-KITCHEN-RUNTIME-002)", () => {
  test.skip(!mutationsAllowed, "Mutating admin flow: requires E2E_ALLOW_MUTATIONS=true.");
  test.use({ viewport: { width: 1280, height: 720 } });

  /** Un pedido real del menú público, con un nombre irrepetible (la base local acumula corridas). */
  async function createMenuOrder(page: Page, label: string): Promise<string> {
    const customer = `${label} ${Date.now()}`;

    await page.goto("/menu");
    await addSeedProductToCart(page);
    await page.goto("/checkout");
    await page.locator('input[name="customerName"]').fill(customer);
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page).toHaveURL(/\/success\/.+/);

    return customer;
  }

  async function openKitchen(page: Page) {
    await loginAsOwner(page);
    await page.goto("/admin/kitchen");
    await expect(page.getByTestId("kitchen-toolbar")).toBeVisible();
  }

  test("el pedido entra en ENTRADA, y aceptar **no** lo manda al fuego", async ({ page }) => {
    const customer = await createMenuOrder(page, "Cliente cocina runtime");
    await openKitchen(page);

    // Tres carriles, con su cuenta.
    await expect(page.getByRole("heading", { name: /^Entrada \d+$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Preparando \d+$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Listos \d+$/ })).toBeVisible();

    const entry = page.getByRole("region", { name: "Entrada" });
    const card = entry.locator("article").filter({ hasText: customer });
    await expect(card).toBeVisible();
    // El canal de origen: el pedido vino del menú público.
    await expect(card).toContainText("Menú");

    await card.getByRole("button", { name: "Aceptar" }).click();

    // El defecto que esta TASK corrige: aceptado sigue en ENTRADA (no salta a preparación), y ahora
    // ofrece **iniciar preparación**.
    await expect(
      entry.locator("article").filter({ hasText: customer }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Preparando" })
        .locator("article")
        .filter({ hasText: customer }),
    ).toHaveCount(0);
    await expect(card.getByTestId("kitchen-waiting-start")).toBeVisible();
    await expect(card.getByRole("button", { name: "Iniciar preparación" })).toBeVisible();
  });

  test("iniciar preparación la pasa al fuego con su cronómetro, y Terminado la deja en LISTOS", async ({
    page,
  }) => {
    const customer = await createMenuOrder(page, "Cliente cocina carriles");
    await openKitchen(page);

    const entry = page.getByRole("region", { name: "Entrada" });
    const card = entry.locator("article").filter({ hasText: customer });

    await card.getByRole("button", { name: "Aceptar" }).click();
    await card.getByRole("button", { name: "Iniciar preparación" }).click();

    const preparing = page.getByRole("region", { name: "Preparando" });
    const inFire = preparing.locator("article").filter({ hasText: customer });
    await expect(inFire).toBeVisible();
    // El cronómetro de cocina, rotulado como la referencia aprobada y contando desde `preparingAt`.
    await expect(inFire.getByTestId("kitchen-prep-timer")).toContainText(/PREP \d+m/);

    await inFire.getByRole("button", { name: "Terminado" }).click();

    const ready = page.getByRole("region", { name: "Listos" });
    const done = ready.locator("article").filter({ hasText: customer });
    await expect(done).toBeVisible();
    // Cocina **termina en Listo**: no hay acción, el pedido ya salió de la cocina.
    await expect(done.getByRole("button", { name: "Terminado" })).toHaveCount(0);
    await expect(done).toContainText("✓ LISTO");
  });

  test("la cocina no ve un solo importe: ni en la tarjeta ni en la cabecera", async ({ page }) => {
    await createMenuOrder(page, "Cliente cocina sin plata");
    await openKitchen(page);

    const body = await page.locator("body").innerText();

    expect(body).not.toMatch(/C\$/);
    expect(body).not.toMatch(/NIO/);
    expect(body).not.toMatch(/US\$/);
    expect(body).not.toMatch(/Total/i);
    expect(body).not.toMatch(/PIN/i);
  });

  test("el botón de modo cocina ya no vive en Órdenes", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/orders");
    await expect(page.getByTestId("comandas-topbar")).toBeVisible();

    await expect(page.getByRole("button", { name: "Modo cocina" })).toHaveCount(0);
    // Y la entrada del panel lleva a la superficie propia (por su `href`, no por el texto: la entrada de
    // Órdenes también dice «Cocina» en su descripción).
    const entry = page.locator('.admin-sidebar-shell a[href="/admin/kitchen"]').first();
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(/\/admin\/kitchen$/);
    await expect(page.getByTestId("kitchen-toolbar")).toBeVisible();
  });

  test("la página no scrollea: el scroll vive en cada carril", async ({ page }) => {
    await openKitchen(page);

    const scroll = await page.evaluate(() => ({
      page: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));

    expect(scroll.page).toBeLessThanOrEqual(2);
    expect(scroll.horizontal).toBeLessThanOrEqual(2);
  });

  test.describe("en la tablet de la cocina", () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test("un carril por vez con su conmutador", async ({ page }) => {
      await openKitchen(page);

      const switcher = page.getByRole("group", { name: "Carril de comandas" });
      await expect(switcher).toBeVisible();

      await expect(page.getByRole("heading", { name: /^Entrada \d+$/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Listos \d+$/ })).toBeHidden();

      await switcher.getByRole("button", { name: /^Listos \d+$/ }).click();

      await expect(page.getByRole("heading", { name: /^Listos \d+$/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Entrada \d+$/ })).toBeHidden();
    });
  });

  test.describe("en el celular de la cocina", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("un carril por vez con su conmutador, y sin scroll horizontal", async ({ page }) => {
      await openKitchen(page);

      const switcher = page.getByRole("group", { name: "Carril de comandas" });
      await expect(switcher).toBeVisible();

      // Arranca en ENTRADA: los otros carriles no se ven (no es que estén vacíos).
      await expect(page.getByRole("heading", { name: /^Entrada \d+$/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Preparando \d+$/ })).toBeHidden();

      await switcher.getByRole("button", { name: /^Preparando \d+$/ }).click();

      await expect(page.getByRole("heading", { name: /^Preparando \d+$/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Entrada \d+$/ })).toBeHidden();

      // Sin scroll horizontal.
      const horizontal = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(horizontal).toBeLessThanOrEqual(2);
    });
  });
});
