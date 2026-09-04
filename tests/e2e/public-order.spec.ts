import { expect, test } from "@playwright/test";

import { mutationsAllowed, setSeedCart } from "./helpers";

test.describe("public pickup ordering", () => {
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("shows menu and creates a pickup order from checkout", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
    await expect(page.getByText("Taco de Birria")).toBeVisible();

    await setSeedCart(page);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Confirmá tu pedido" })).toBeVisible();
    await expect(page.getByText("Taco de Birria")).toBeVisible();
    await expect(page.getByText("Delivery")).toHaveCount(0);
    await expect(page.getByText("Mesa")).toHaveCount(0);

    await page.locator('input[name="customerName"]').fill("Cliente E2E");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();

    await expect(page).toHaveURL(/\/success\/.+/);
    await expect(page.getByText(/Recibida|Confirmada|En preparación|Retiro/)).toBeVisible();
  });

  test("keeps reservation entry points out of the MVP", async ({ page }) => {
    await page.goto("/reservations");
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
  });
});
