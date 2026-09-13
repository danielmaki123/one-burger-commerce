import { expect, test } from "@playwright/test";

import { addSeedProductToCart } from "./helpers";

/**
 * T5 — el carrito y el punto de retiro del checkout, en navegador real.
 *
 * El mock tiene edición por ítem dentro de su carrito (cantidad y quitar) y una
 * tarjeta de sucursal con la dirección; acá se comprueba que la nuestra edite de
 * verdad y muestre dónde se retira, a 375 px.
 */
test.describe("carrito público", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("la cantidad se edita en línea y el ítem se puede quitar", async ({ page }) => {
    await addSeedProductToCart(page);
    await page.goto("/cart");

    await expect(page.getByRole("heading", { name: "Tu carrito" })).toBeVisible();
    await expect(page.getByText("1 producto", { exact: true }).first()).toBeVisible();

    // El subtotal se lee del resumen tal como lo ve el cliente.
    const subtotalText = async () => {
      const body = await page.locator("body").innerText();
      return body.match(/Subtotal[\s\S]{0,40}?(C\$[\d.,]+)/)?.[1] ?? "";
    };
    const before = await subtotalText();
    expect(before).not.toBe("");

    await page.getByRole("button", { name: /Sumar una unidad/ }).click();
    await expect(page.getByText("2 productos", { exact: true }).first()).toBeVisible();
    expect(await subtotalText()).not.toBe(before);

    await page.getByRole("button", { name: /Restar una unidad/ }).click();
    await expect(page.getByText("1 producto", { exact: true }).first()).toBeVisible();
    expect(await subtotalText()).toBe(before);

    await page.getByRole("button", { name: /Quitar .* del carrito/ }).click();
    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();
  });

  test("el checkout dice dónde se retira", async ({ page }) => {
    await addSeedProductToCart(page);
    await page.goto("/checkout");

    // La dirección sale de la configuración: el local demo la tiene cargada.
    // Se afirma **dentro de la fila del punto de retiro** y no en toda la página: desde A-07 el
    // footer lista la dirección de cada sucursal, y con el local demo (que hereda la dirección de
    // la configuración) el mismo texto aparece dos veces en el DOM —a 375 px el footer está
    // oculto por CSS pero sigue contando para el modo estricto de Playwright—. La fila es lo que
    // el cliente lee en el checkout; el footer tiene su propia verificación en public-home.spec.ts.
    const pickupRow = page.getByText("Retirás en").locator("..");
    await expect(pickupRow).toBeVisible();
    await expect(pickupRow.getByText(/Retiro en restaurante/)).toBeVisible();
  });
});

test.describe("carrito público en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("el carrito y el resumen entran sin scroll horizontal (1280 px)", async ({ page }) => {
    await addSeedProductToCart(page);
    await page.goto("/cart");

    await expect(page.getByRole("heading", { name: "Tu carrito" })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
