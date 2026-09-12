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

  test("la vista previa dice qué vería el cliente, sin guardar nada (fase 2)", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/settings");

    // El panel resuelve "ahora" después de montar: si no, el HTML del servidor y el
    // del cliente no coincidirían al hidratar.
    const panel = page.getByLabel("Vista previa del retiro");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Así lo ve el cliente");
    await expect(panel).toContainText(/Lo antes posible · listo/);

    const lastOrder = panel.locator("strong");
    await expect(lastOrder).toHaveText(/\d{1,2}:\d{2} [ap]\. m\./);

    // Cambiar los minutos de preparación mueve la última orden: 10 minutos más de
    // cocina es un pedido menos sobre el cierre.
    const before = await lastOrder.innerText();
    await page.getByLabel("Minutos de preparación").fill("60");
    await expect(lastOrder).not.toHaveText(before);

    // Nada de esto se guardó: al recargar vuelve lo que estaba.
    await page.reload();
    await expect(page.getByLabel("Minutos de preparación")).not.toHaveValue("60");

    // Y el panel entra en 375 px sin scroll horizontal.
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
