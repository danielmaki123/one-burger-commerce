import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, mutationsAllowed } from "./helpers";

/**
 * T6 — la confirmación del pedido.
 *
 * El mock tiene dos bloques con el mismo mensaje ("¡Orden confirmada!" y
 * "¡Recibimos tu pedido!"), cuatro enlaces `href="#"` y una barra inferior de
 * mentira. Acá se comprueba que nuestra confirmación diga una sola vez lo que
 * pasó, que las dos salidas del mock funcionen y que no haya enlaces muertos.
 */
async function createOrder(page: Page) {
  await addSeedProductToCart(page);
  await page.goto("/checkout");
  await page.locator('input[name="customerName"]').fill("Cliente Confirmación");
  await page.locator('input[name="customerWhatsapp"]').fill("88887777");
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();
  await expect(page).toHaveURL(/\/success\/.+/);
}

test.describe("confirmación del pedido", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("dice una sola vez qué pasó, con el número y las dos salidas (375 px)", async ({ page }) => {
    await createOrder(page);

    // Una sola confirmación: el mock repite el mensaje en dos bloques.
    await expect(page.getByRole("heading", { name: "¡Pedido confirmado!" })).toHaveCount(1);

    // El número de pedido, como dato: es el código que se dicta en caja.
    await expect(page.getByText("Número de pedido")).toBeVisible();
    await expect(page.getByText(/^P-[A-Z0-9]+$/)).toBeVisible();

    // Y para cuándo: la hora de retiro con su estimación.
    await expect(page.getByText("Hora de retiro")).toBeVisible();

    // El PIN de retiro (T13): cuatro dígitos, para dictarlos en caja.
    await expect(page.getByText("PIN de retiro")).toBeVisible();
    await expect(page.getByText(/^\d{4}$/)).toBeVisible();

    // Ningún enlace muerto de los que tiene el mock.
    const deadLinks = await page.locator('a[href="#"]').count();
    expect(deadLinks).toBe(0);

    // Las dos salidas del mock: seguir el pedido y volver a la carta.
    await expect(page.getByRole("button", { name: "Ver mis pedidos" })).toBeVisible();
    await page.getByRole("button", { name: "Volver a la carta" }).click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
  });

  test("el pedido recién hecho queda en el historial del dispositivo", async ({ page }) => {
    await createOrder(page);

    await page.getByRole("button", { name: "Ver mis pedidos" }).click();
    await expect(page).toHaveURL(/\/activity/);
    // El historial lista el pedido que se acaba de crear.
    await expect(page.getByText(/P-|D-/).first()).toBeVisible();
  });
});

test.describe("confirmación del pedido en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("las tres salidas quedan en una fila y no hay scroll horizontal (1280 px)", async ({
    page,
  }) => {
    await createOrder(page);

    // Tres salidas desde el hallazgo H3b: el historial, el seguimiento del pedido recién hecho y volver a
    // la carta. En escritorio van en una sola fila.
    const viewActivity = page.getByRole("button", { name: "Ver mis pedidos" });
    const trackOrder = page.getByRole("button", { name: "Seguí tu pedido" });
    const orderAgain = page.getByRole("button", { name: "Volver a la carta" });
    await expect(viewActivity).toBeVisible();
    await expect(trackOrder).toBeVisible();
    await expect(orderAgain).toBeVisible();

    const boxes = await Promise.all([
      viewActivity.boundingBox(),
      trackOrder.boundingBox(),
      orderAgain.boundingBox(),
    ]);
    expect(boxes[0]!.y).toBe(boxes[1]!.y);
    expect(boxes[1]!.y).toBe(boxes[2]!.y);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
