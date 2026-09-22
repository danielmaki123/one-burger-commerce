import { expect, test } from "@playwright/test";

import { loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — **Config de Caja**, de punta a punta.
 *
 * El caso es el que importa de la fase: el dueño cambia una regla del arqueo y la **Caja la obedece**. Lo
 * que se verifica en un navegador real, y no en la unidad, es el recorrido completo: la pantalla guarda
 * (`PUT /api/admin/cash/config`), la Caja del mismo local lee la config (resuelta en el servidor) y la
 * grilla del conteo ofrece —o deja de ofrecer— el dólar.
 *
 * Deja la configuración **como estaba**: el spec guarda el estado original y lo restaura al final (la base
 * local es compartida y otras suites cuentan con la config de fábrica).
 */

test.describe("config de caja", () => {
  test("el dueño prende los dólares y la Caja los ofrece", async ({ page }) => {
    test.skip(!mutationsAllowed, "Guardar la configuración toca la base: E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    await page.goto("/admin/cash/config");
    const usdToggle = page.getByLabel("Esta sucursal cuenta dólares");
    await expect(usdToggle).toBeVisible();

    const original = await usdToggle.isChecked();

    await usdToggle.setChecked(!original);
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible();

    // La Caja del mismo local cuenta (o no) en dólares según lo que se acaba de guardar.
    await page.goto("/admin/cash");
    const usdBill = page.getByLabel("Cantidad de billetes de USD 100");

    if (original) {
      await expect(usdBill).toHaveCount(0);
    } else {
      await expect(usdBill.first()).toBeVisible();
    }

    // Y se deja como estaba.
    await page.goto("/admin/cash/config");
    const restored = page.getByLabel("Esta sucursal cuenta dólares");
    await expect(restored).toBeChecked({ checked: !original });
    await restored.setChecked(original);
    await page.getByRole("button", { name: "Guardar configuración" }).click();
    await expect(page.getByText("Configuración guardada.")).toBeVisible();
    await expect(restored).toBeChecked({ checked: original });
  });
});
