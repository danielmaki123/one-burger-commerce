import { expect, test } from "@playwright/test";

import {
  ADMIN_PASSWORD,
  createAdminUserViaUi,
  loginAsOwner,
  logoutAdmin,
  mutationsAllowed,
} from "./helpers";

test.describe("admin operations", () => {
  test.skip(!mutationsAllowed, "Admin mutations are disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("owner can sign in and manage users", async ({ page }) => {
    await loginAsOwner(page);
    await createAdminUserViaUi(page, {
      name: "Cocina E2E",
      email: `cocina-${Date.now()}@example.com`,
      password: "Cocina123!",
      role: "kitchen",
    });
  });

  test("owner can change a role and revoke access", async ({ page }) => {
    await loginAsOwner(page);

    const email = `cambio-${Date.now()}@example.com`;
    await createAdminUserViaUi(page, {
      name: "Cambio E2E",
      email,
      password: ADMIN_PASSWORD,
      role: "kitchen",
    });

    const row = page.getByRole("article").filter({ hasText: email });
    await expect(row).toBeVisible();
    await row.getByLabel("Rol de Cambio E2E").selectOption("manager");
    await expect(page.getByText("Rol actualizado.")).toBeVisible();

    // Revoking asks for confirmation; Playwright dismisses dialogs by default.
    page.on("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: "Revocar acceso de Cambio E2E" }).click();
    await expect(page.getByText("Acceso revocado.")).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);
  });

  test("kitchen user can access orders but not user management", async ({ page }) => {
    await loginAsOwner(page);

    const email = `kitchen-${Date.now()}@example.com`;
    await createAdminUserViaUi(page, {
      name: "Kitchen E2E",
      email,
      password: ADMIN_PASSWORD,
      role: "kitchen",
    });

    await logoutAdmin(page);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Órdenes" })).toBeVisible();

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });

  test("owner dashboard and navigation stay inside the pickup MVP", async ({ page }) => {
    await loginAsOwner(page);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
    await expect(page.getByText("Reservas del período")).toHaveCount(0);
    await expect(page.getByText("Reservas hoy")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Delivery", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Inventario/ })).toHaveCount(0);
  });

  test("removed admin table routes redirect to orders", async ({ page }) => {
    await loginAsOwner(page);

    await page.goto("/admin/tables");
    await expect(page).toHaveURL(/\/admin\/orders$/);

    await page.goto("/admin/reservations");
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });
});
