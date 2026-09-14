import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * TASK-303a — el tipo de cambio del dólar, de punta a punta.
 *
 * Es la tasa con la que el mostrador convierte un cobro en dólares. Si el guardado no llegara a la
 * base, el POS cobraría con una tasa vieja sin que nadie lo note: es la misma clase de bug que tuvo
 * `paymentMethod` en T11, cuando el adaptador de Prisma no escribía el campo y el unitario pasaba
 * igual porque el adaptador en memoria sí lo hacía. Por eso se verifica contra la base, recargando.
 *
 * El test deja la configuración como la encontró (vacía), así corre dos veces seguidas.
 */
async function saveRate(page: Page, value: string) {
  await page.goto("/admin/settings");
  await page.getByLabel(/Tipo de cambio del dólar/).fill(value);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Cambios guardados ✓")).toBeVisible();
}

test.describe("tipo de cambio del dólar", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el owner lo carga, persiste y lo puede dejar vacío", async ({ page }) => {
    await loginAsOwner(page);

    await saveRate(page, "36.5");

    // Persistió de verdad: se recarga la pantalla y el valor sigue ahí.
    await page.goto("/admin/settings");
    await expect(page.getByLabel(/Tipo de cambio del dólar/)).toHaveValue("36.5");

    // Un dedazo no se guarda (el tope es para atajar 100001, no un movimiento del mercado).
    await page.getByLabel(/Tipo de cambio del dólar/).fill("100001");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados ✓")).toBeHidden();

    // Vacío = sin tasa cargada: un cobro en dólares se rechaza con el motivo en vez de convertir a ojo.
    await saveRate(page, "");
    await page.goto("/admin/settings");
    await expect(page.getByLabel(/Tipo de cambio del dólar/)).toHaveValue("");
  });
});
