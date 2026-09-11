import { expect, test, type Locator, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Contrato del checkout tras TASK-checkout-ux: cada cosa una sola vez y un solo CTA
 * visible por ancho de pantalla.
 *
 * Se verifica en un navegador real a propósito. `getByRole` ignora lo que está oculto
 * por CSS, así que "un solo botón" se afirma directamente; antes hacía falta
 * `.filter({ visible: true }).first()` para desambiguar los duplicados del bug.
 */
function confirmButton(page: Page): Locator {
  return page.getByRole("button", { name: /Confirmar pedido/ });
}

async function openCheckoutWithOneProduct(page: Page) {
  await page.goto("/menu");
  await addSeedProductToCart(page);
  await page.goto("/checkout");
}

test.describe("checkout sin redundancias", () => {
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("no repite encabezados, totales ni botones", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    await expect(page.getByRole("heading", { name: "Confirmá tu pedido" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Resumen del pedido" })).toHaveCount(1);
    await expect(confirmButton(page)).toHaveCount(1);
    await expect(page.getByText("Total a pagar")).toHaveCount(1);
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toHaveCount(1);
  });

  test("los turnos de retiro salen de la configuración", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    // "Lo antes posible" ya no es una opción aparte que manda una hora fija: es el
    // primer turno calculado, con su hora real.
    const soonest = page.getByRole("button", { name: /^Lo antes posible · \d/ });
    await expect(soonest).toBeVisible();
    await expect(soonest).toHaveAttribute("aria-pressed", "true");
  });

  test("el botón no arranca deshabilitado y señala el campo que falta", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    // Un botón inerte que parece activo era el defecto: ahora se puede tocar siempre.
    await expect(confirmButton(page)).toBeEnabled();
    await confirmButton(page).click();

    await expect(page.getByText("Falta completar nombre.")).toHaveCount(1);
    await expect(page.locator('input[name="customerName"]')).toBeFocused();
  });

  test("el negocio cerrado bloquea el pedido de verdad, no solo en el texto", async ({
    page,
  }) => {
    await openCheckoutWithOneProduct(page);
    await expect(confirmButton(page)).toBeEnabled();

    await loginAsOwner(page);
    await page.goto("/admin/settings");
    const accepting = page.getByRole("checkbox", { name: "Aceptando pedidos" });
    // El input está estilizado con `appearance-none` y un SVG lo tapa, así que
    // Playwright no puede clickearlo directo: se clickea la etiqueta, que lo alterna.
    const acceptingLabel = page.getByText("Aceptando pedidos", { exact: true });
    await expect(accepting).toBeChecked();

    try {
      await acceptingLabel.click();
      await expect(accepting).not.toBeChecked();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Cambios guardados ✓")).toBeVisible();

      await page.goto("/checkout");
      await expect(confirmButton(page)).toBeDisabled();
      await expect(page.getByRole("status")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Lo antes posible/ })).toHaveCount(0);
    } finally {
      await page.goto("/admin/settings");
      await page.getByText("Aceptando pedidos", { exact: true }).click();
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Cambios guardados ✓")).toBeVisible();
    }

    // Y al reactivarlo, se puede volver a pedir.
    await page.goto("/checkout");
    await expect(confirmButton(page)).toBeEnabled();
  });

  test("creates a pickup order from checkout", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Taco de Birria" }),
    ).toBeVisible();

    await addSeedProductToCart(page);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Confirmá tu pedido" })).toBeVisible();
    await expect(page.getByText("Taco de Birria").first()).toBeVisible();
    await expect(page.getByText("Delivery")).toHaveCount(0);
    await expect(page.getByText("Mesa")).toHaveCount(0);

    // Payment and tip must be explicit before the customer confirms.
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toBeVisible();
    const tipToggle = page.getByRole("checkbox", { name: /Agregar propina del 10%/ });
    await expect(tipToggle).not.toBeChecked();
    await expect(page.getByText(/^Propina \(/)).toHaveCount(0);

    await page.locator('input[name="customerName"]').fill("Cliente E2E");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await confirmButton(page).click();

    await expect(page).toHaveURL(/\/success\/.+/);
    await expect(
      page.getByText(/Recibida|Confirmada|En preparación/).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toBeVisible();
    await expect(page.getByText("No agregada")).toBeVisible();
  });

  test("keeps reservation entry points out of the MVP", async ({ page }) => {
    await page.goto("/reservations");
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
  });
});

test.describe("checkout en celular", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("muestra un solo CTA y un solo total", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    await expect(confirmButton(page)).toHaveCount(1);
    await expect(page.getByText("Total a pagar")).toHaveCount(1);
    // El importe viaja en la etiqueta del botón, no en una fila aparte.
    await expect(confirmButton(page)).toContainText("C$");
  });
});
