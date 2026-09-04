import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "Admin1234!";
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ADMIN_EMAIL;
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ADMIN_PASSWORD;
export const mutationsAllowed = process.env.E2E_ALLOW_MUTATIONS === "true";

export async function loginAsOwner(page: Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(E2E_ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);
}

export async function setSeedCart(page: Page) {
  await page.goto("/menu");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "one-burger-cart",
      JSON.stringify([
        {
          productId: "seed-prod-01",
          productName: "Taco de Birria",
          quantity: 1,
          unitPrice: 35,
          packagingUnitAmount: 0,
          packagingTotalAmount: 0,
          modifierOptionIds: [],
          modifiers: [],
          lineTotal: 35,
        },
      ]),
    );
  });
}
