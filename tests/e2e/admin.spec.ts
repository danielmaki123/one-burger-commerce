import { expect, test } from "@playwright/test";

import { ADMIN_PASSWORD, loginAsOwner, mutationsAllowed } from "./helpers";

test.describe("admin operations", () => {
  test.skip(!mutationsAllowed, "Admin mutations are disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("owner can sign in and manage users", async ({ page }) => {
    await loginAsOwner(page);

    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
    await expect(page.getByText("Admin One Burger")).toBeVisible();

    const email = `cocina-${Date.now()}@example.com`;
    await page.locator('input[type="text"]').first().fill("Cocina E2E");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("Cocina123!");
    await page.locator("select").selectOption("kitchen");
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await expect(page.getByText("Usuario creado correctamente.")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("kitchen user can access orders but not user management", async ({ page }) => {
    await loginAsOwner(page);

    const email = `kitchen-${Date.now()}@example.com`;
    await page.request.post("/api/admin/users", {
      data: {
        name: "Kitchen E2E",
        email,
        password: ADMIN_PASSWORD,
        role: "kitchen",
      },
    });

    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Órdenes" })).toBeVisible();

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });

  test("removed admin table routes redirect to orders", async ({ page }) => {
    await loginAsOwner(page);

    await page.goto("/admin/tables");
    await expect(page).toHaveURL(/\/admin\/orders$/);

    await page.goto("/admin/reservations");
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });
});
