import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * T9c — promos con código, de punta a punta.
 *
 * El recorrido completo: el owner crea la promo en `/admin/promotions`, el cliente
 * escribe el código en el checkout y el descuento aparece en la confirmación. Es el
 * único test que prueba que la pantalla, la API, la base y el motor hablan el mismo
 * idioma: los unitarios usan el adaptador en memoria.
 */
const CODE = "E2E-2X1";
const ROW = `Editar promo ${CODE}`;

async function deletePromotionIfPresent(page: Page) {
  await page.goto("/admin/promotions");

  const row = page.getByRole("button", { name: ROW });
  // La lista llega por fetch: sin esperar, una corrida anterior deja la promo y el
  // alta siguiente falla por código duplicado.
  await expect(page.getByText("Cargando promos…")).toBeHidden();
  if ((await row.count()) === 0) return;

  await row.first().click();
  // `window.confirm` del borrado: Playwright lo descarta por defecto.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: `Eliminar promo ${CODE}` }).click();
  await expect(page.getByText("Promo borrada.")).toBeVisible();
}

test.describe("promos con código", () => {
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("el owner crea la promo, el cliente la aplica y se ve el descuento", async ({ page }) => {
    await loginAsOwner(page);
    await deletePromotionIfPresent(page);

    // 1) El owner la crea desde el admin.
    await page.getByRole("button", { name: "Nueva promo" }).click();
    await page.getByLabel("Código", { exact: true }).fill(CODE);
    await page.getByLabel("Tipo").selectOption("bogo");
    await page.getByLabel("Unidades que se llevan").fill("1");
    await page.getByLabel("Unidades gratis").fill("1");
    await expect(page.getByLabel("Alcance")).toHaveValue("all");
    await page.getByRole("button", { name: "Crear promo" }).click();

    await expect(page.getByText("Promo creada.")).toBeVisible();
    // La ficha se explica como la lee el cliente: 1 + 1 = llevá 2 y pagá 1.
    await expect(page.getByRole("button", { name: ROW })).toContainText("Llevá 2 y pagá 1");
    await expect(page.getByRole("button", { name: ROW })).toContainText("Activa");

    // 2) El cliente la aplica en el checkout. Dos unidades del plato de C$35.
    await addSeedProductToCart(page);
    await addSeedProductToCart(page);
    await page.goto("/checkout");

    await page.getByLabel("Código de promo").fill(CODE);
    await page.getByRole("button", { name: "Aplicar" }).click();

    // El servidor confirma la forma de la promo, y avisa que el monto lo calcula al confirmar.
    await expect(page.getByText(/Llevá 2 y pagá 1/)).toBeVisible();

    await page.locator('input[name="customerName"]').fill("Cliente Promo");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page).toHaveURL(/\/success\/.+/);

    // 3) El descuento real: 2 × C$35 = C$70, una unidad gratis, total C$35.
    await expect(page.getByText("Subtotal")).toBeVisible();
    await expect(page.getByText("C$70.00")).toBeVisible();
    await expect(page.getByText("Descuento")).toBeVisible();
    await expect(page.getByText("-C$35.00")).toBeVisible();
    // El total, sin confundirlo con el "-C$35.00" del descuento.
    await expect(page.getByText("C$35.00", { exact: true })).toBeVisible();

    // 4) Y el uso queda contado: el owner lo ve en la lista.
    await page.goto("/admin/promotions");
    await expect(page.getByRole("button", { name: ROW })).toContainText("1 uso · sin límite");

    // Se limpia la promo para no dejar datos de prueba en la base.
    await deletePromotionIfPresent(page);
  });
});

test.describe("promos en celular", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("la lista y el formulario entran en 375 px", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/promotions");

    await expect(page.getByRole("heading", { name: "Promos" })).toBeVisible();
    await page.getByRole("button", { name: "Nueva promo" }).click();

    // Todos los campos del formulario se pueden alcanzar sin salirse de la hoja.
    await expect(page.getByLabel("Código", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Tipo")).toBeVisible();
    await expect(page.getByLabel("Porcentaje (%)")).toBeVisible();
    await expect(page.getByLabel("Límite de usos")).toBeVisible();
    await expect(page.getByLabel("Vence el")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear promo" })).toBeVisible();

    // El campo del código explica dónde lo va a escribir el cliente.
    await expect(page.getByText(/Se guarda en mayúsculas/)).toBeVisible();
  });
});
