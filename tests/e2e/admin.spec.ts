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
    await expect(page.getByRole("heading", { name: "Órdenes", exact: true })).toBeVisible();

    /**
     * B6 · Punto 3 — el modo cocina y su salida, con la cuenta que encontró el problema.
     *
     * El owner entró con una cuenta de sucursal, tocó «Volver al panel» y volvió a la misma pantalla:
     * el tablero se abría sin la barra lateral y no había manera de recuperarla. Desde el layout
     * unificado (2026-09-18) el chrome se ve siempre y esconderlo es el **modo cocina**, que se sale
     * con «Salir» —sin cerrar sesión, porque la sesión vive en esa barra.
     */
    await expect(page.locator(".admin-sidebar-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    await page.getByRole("button", { name: "Modo cocina" }).click();
    await expect(page.locator(".admin-sidebar-shell")).toBeHidden();

    await page.getByRole("button", { name: "Salir" }).click();

    await expect(page.locator(".admin-sidebar-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

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

  test("owner changes the business name and the public site shows it without a redeploy", async ({
    page,
  }) => {
    await loginAsOwner(page);

    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Personalización del negocio" }),
    ).toBeVisible();

    const nameInput = page.getByLabel("Nombre *");
    const originalName = await nameInput.inputValue();
    const editedName = `Burger E2E ${Date.now()}`;

    try {
      await nameInput.fill(editedName);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Cambios guardados ✓")).toBeVisible();

      // La ruta pública es dinámica: el cambio se ve en la siguiente carga.
      await page.goto("/menu");
      await expect(page.getByText(editedName).first()).toBeVisible();
    } finally {
      await page.goto("/admin/settings");
      await page.getByLabel("Nombre *").fill(originalName);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Cambios guardados ✓")).toBeVisible();
    }
  });

  test("la paleta del mock se aplica como preset y se ve en la vista previa (375 px)", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Personalización del negocio" }),
    ).toBeVisible();

    const preview = page.locator('[aria-label="Vista previa"]');
    const previewVar = async (name: string) =>
      preview.evaluate(
        (el, variable) => getComputedStyle(el).getPropertyValue(variable).trim(),
        name,
      );

    const preset = page.getByRole("button", { name: "Pimienta", exact: true });
    await expect(preset).toBeVisible();
    await expect(preset).toHaveAttribute("aria-pressed", "false");

    // El preset cumple el mínimo táctil del repo; los botones equivalentes del mock miden 24 px.
    const box = await preset.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    const brandBefore = await previewVar("--brand");
    await preset.click();

    await expect(preset).toHaveAttribute("aria-pressed", "true");
    // Los colores del mock, leídos del navegador real sobre la vista previa en vivo.
    expect(brandBefore).not.toBe("#d32f2f");
    expect(await previewVar("--brand")).toBe("#d32f2f");
    expect(await previewVar("--background")).toBe("#faf1d6");
    expect(await previewVar("--card")).toBe("#fffdf9");

    // Es una vista previa: mientras el owner no guarde, el sitio publicado no cambia.
    await expect(page.getByText("Cambios guardados ✓")).toHaveCount(0);
  });

  test("a manager cannot reach the business settings", async ({ page }) => {
    await loginAsOwner(page);

    const email = `manager-settings-${Date.now()}@example.com`;
    await createAdminUserViaUi(page, {
      name: "Manager E2E",
      email,
      password: ADMIN_PASSWORD,
      role: "manager",
    });

    await logoutAdmin(page);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);

    await page.goto("/admin/settings");
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });
});
