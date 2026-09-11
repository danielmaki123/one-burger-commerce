import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, mutationsAllowed } from "./helpers";

/**
 * T7 — historial y seguimiento.
 *
 * El mock trae un historial con buscador **inerte**, un "Pedir nuevamente" que no
 * repite nada y un paso a paso dibujado sin texto. Acá el buscador filtra, repetir
 * vuelve a armar el pedido y el timeline dice en qué paso está.
 */
async function createOrderAndOpenHistory(page: Page) {
  await addSeedProductToCart(page);
  await page.goto("/checkout");
  await page.locator('input[name="customerName"]').fill("Cliente Historial");
  await page.locator('input[name="customerWhatsapp"]').fill("88887777");
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();
  await expect(page).toHaveURL(/\/success\/.+/);
  await page.goto("/activity?tab=orders");
}

test.describe("historial del cliente", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("muestra el pedido real, con su progreso y su estimado (375 px)", async ({ page }) => {
    await createOrderAndOpenHistory(page);

    // El resumen sale de las líneas guardadas, no de un plato escrito a mano.
    await expect(page.getByText("1 × Taco de Birria")).toBeVisible();
    await expect(page.getByText(/^P-[A-Z0-9]+$/)).toBeVisible();
    await expect(page.getByText("Paso 1 de 5")).toBeVisible();
    await expect(page.getByText("Recibida").first()).toBeVisible();
    await expect(page.getByText(/^Listo ~/)).toBeVisible();

    // Y no queda rastro del plato del mock viejo.
    await expect(page.getByText(/Sangría|Aperol/)).toHaveCount(0);
  });

  test("el buscador del historial filtra de verdad", async ({ page }) => {
    await createOrderAndOpenHistory(page);

    const search = page.getByLabel("Buscar en el historial");
    await search.fill("birria");
    await expect(page.getByText("1 × Taco de Birria")).toBeVisible();

    await search.fill("sushi");
    await expect(page.getByText("No encontramos pedidos con esa búsqueda")).toBeVisible();

    await page.getByRole("button", { name: "Ver todos" }).click();
    await expect(page.getByText("1 × Taco de Birria")).toBeVisible();
  });

  test("'Pedir nuevamente' vuelve a armar el carrito", async ({ page }) => {
    await createOrderAndOpenHistory(page);

    await page.getByRole("button", { name: "Pedir nuevamente" }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("heading", { name: "Tu carrito" })).toBeVisible();
    await expect(page.getByText("Taco de Birria").first()).toBeVisible();
    await expect(page.getByText("1 producto").first()).toBeVisible();
  });

  test("el recibo del pedido se abre desde el historial", async ({ page }) => {
    await createOrderAndOpenHistory(page);

    await page.getByRole("button", { name: "Ver recibo" }).click();

    await expect(page.getByText("Resumen del pedido")).toBeVisible();
    await expect(page.getByText(/^P-[A-Z0-9]+$/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver al historial" }).first()).toBeVisible();
  });
});

test.describe("historial del cliente en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("entra sin scroll horizontal y el timeline se lee (1280 px)", async ({ page }) => {
    await createOrderAndOpenHistory(page);

    await expect(page.getByText("Paso 1 de 5")).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
