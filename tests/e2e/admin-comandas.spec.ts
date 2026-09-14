import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * B3 — el turno como tablero de comandas, en un navegador real.
 *
 * Lo que los tests de jsdom no pueden ver: que en celular se vea **un carril por vez**, que la barra
 * lateral del panel esté escondida en esta vista (y que el enlace para volver exista), y que el
 * tablero ocupe el ancho. Muta datos: solo con `E2E_ALLOW_MUTATIONS=true`, nunca contra producción.
 */
test.describe("comandas: el tablero del turno (B3)", () => {
  test.skip(!mutationsAllowed, "Mutating admin flow: requires E2E_ALLOW_MUTATIONS=true.");

  test.use({ viewport: { width: 1280, height: 900 } });

  async function createOrder(page: Page, label: string): Promise<string> {
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

  async function openBoard(page: Page) {
    await loginAsOwner(page);
    await page.goto("/admin/orders");
    await expect(page.getByTestId("comandas-topbar")).toBeVisible();
  }

  test("el pedido que entra cae en «Por aceptar» y avanza de carril al aceptarlo", async ({ page }) => {
    const customer = await createOrder(page, "Cliente B3 tablero");
    await openBoard(page);

    // Tres carriles, con su cuenta, y la barra del turno con los contadores y la salida al panel.
    await expect(page.getByRole("heading", { name: /Por aceptar \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /En preparación \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Listas \(\d+\)/ })).toBeVisible();

    const topbar = page.getByTestId("comandas-topbar");
    await expect(topbar).toContainText("Nuevas");
    await expect(topbar).toContainText("Preparando");
    await expect(topbar).toContainText("Listas");
    await expect(page.getByRole("link", { name: /Volver al panel/ })).toBeVisible();

    // La comanda está en el carril de lo que nadie aceptó todavía.
    const pending = page.getByRole("region", { name: "Por aceptar" });
    const card = pending.locator("article").filter({ hasText: customer });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Entró \d/);

    await card.getByRole("button", { name: "Aceptar" }).click();

    // Al aceptarla se va del carril de nuevas: ya es trabajo de cocina.
    await expect(
      page.getByRole("region", { name: "En preparación" }).locator("article").filter({ hasText: customer }),
    ).toBeVisible();
    await expect(pending.locator("article").filter({ hasText: customer })).toHaveCount(0);
  });

  test("la vista ocupa el ancho: la barra lateral del panel queda escondida (B3)", async ({ page }) => {
    await openBoard(page);

    await expect(page.locator(".admin-sidebar-shell")).toBeHidden();
  });

  test.describe("en el celular de la cocina", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("se ve un carril por vez y el conmutador cambia de carril (375 px)", async ({ page }) => {
      await openBoard(page);

      const switcher = page.getByRole("group", { name: "Carril de comandas" });
      await expect(switcher).toBeVisible();

      // Arranca en "Por aceptar": los otros dos carriles no se ven (no es que estén vacíos).
      await expect(page.getByRole("heading", { name: /Por aceptar \(\d+\)/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /En preparación \(\d+\)/ })).toBeHidden();

      await switcher.getByRole("button", { name: /^En preparación \d+$/ }).click();

      await expect(page.getByRole("heading", { name: /En preparación \(\d+\)/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Por aceptar \(\d+\)/ })).toBeHidden();
    });
  });
});
