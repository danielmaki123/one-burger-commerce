import { expect, test } from "@playwright/test";

import { addSeedProductToCart, mutationsAllowed } from "./helpers";

test.describe("public pickup ordering", () => {
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("shows menu and creates a pickup order from checkout", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Taco de Birria" }),
    ).toBeVisible();

    await addSeedProductToCart(page);
    await page.goto("/checkout");

    await expect(
      page
        .getByRole("heading", { name: "Confirmá tu pedido" })
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await expect(page.getByText("Taco de Birria").first()).toBeVisible();
    await expect(page.getByText("Delivery")).toHaveCount(0);
    await expect(page.getByText("Mesa")).toHaveCount(0);

    // Payment and tip must be explicit before the customer confirms.
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toBeVisible();
    const tipToggle = page.getByRole("checkbox", { name: /Agregar propina del 10%/ });
    await expect(tipToggle).not.toBeChecked();
    await expect(page.getByText(/^Propina \(/)).toHaveCount(0);

    await page.locator('input[name="customerName"]').fill("Cliente E2E");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await page
      .getByRole("button", { name: /Confirmar pedido/ })
      .filter({ visible: true })
      .first()
      .click();

    await expect(page).toHaveURL(/\/success\/.+/);
    await expect(
      page.getByText(/Recibida|Confirmada|En preparación/).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toBeVisible();
    await expect(page.getByText("No agregada")).toBeVisible();
  });

  test("keeps reservation entry points out of the MVP", async ({ page }) => {
    await page.goto("/reservations");
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
  });
});
