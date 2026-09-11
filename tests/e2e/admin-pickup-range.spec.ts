import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner } from "./helpers";

/**
 * T5 — el rango de preparación, de punta a punta.
 *
 * El negocio configura un máximo y el cliente deja de ver un instante exacto que
 * la cocina puede fallar: ve una franja. La hora que **se guarda** sigue siendo el
 * mínimo, así que el admin no cambia su forma de trabajar.
 *
 * El test deja la configuración como la encontró: primero la normaliza a "sin
 * rango" y al final vuelve a ese estado, así corre igual dos veces seguidas.
 */
async function savePickupMax(page: Page, value: string) {
  await page.goto("/admin/settings");
  await page.getByLabel(/Máximo del rango/).fill(value);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados ✓")).toBeVisible();
}

test.describe("rango de preparación", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el owner configura el máximo y el checkout promete una franja", async ({ page }) => {
    await loginAsOwner(page);

    // Estado conocido de partida.
    await savePickupMax(page, "");

    await savePickupMax(page, "40");
    await addSeedProductToCart(page);
    await page.goto("/checkout");

    const asap = page.getByRole("button", { name: /Lo antes posible · listo entre / });
    await expect(asap).toBeVisible();

    // Y se puede volver a una sola hora.
    await savePickupMax(page, "");
    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: /Lo antes posible · listo ~/ })).toBeVisible();
  });

  test("el máximo no puede quedar por debajo del mínimo", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/settings");

    const maxInput = page.getByLabel(/Máximo del rango/);
    const originalMax = await maxInput.inputValue();

    await page.getByLabel("Minutos de preparación").fill("60");
    await maxInput.fill("30");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    // El aviso dice qué pasa con los números, no "error de validación".
    await expect(page.getByText(/mayor o igual/i)).toBeVisible();

    // Y no se guarda: no aparece el mensaje de guardado.
    await expect(page.getByText("Cambios guardados ✓")).toHaveCount(0);

    // Se recarga el formulario y el máximo guardado sigue siendo el de antes.
    await page.reload();
    await expect(page.getByLabel(/Máximo del rango/)).toHaveValue(originalMax);
  });
});
