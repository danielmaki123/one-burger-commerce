import { expect, test } from "@playwright/test";

test.describe("production smoke", () => {
  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const payload = await response.json();
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("one-burger-commerce");
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
});
