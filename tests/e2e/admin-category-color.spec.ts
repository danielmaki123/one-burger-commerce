import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * T3.1 — color por categoría, de punta a punta.
 *
 * El owner elige el color en `/admin/menu`; la carta pública pinta con él las
 * tarjetas de esa categoría. Se prueba en navegador real porque lo que importa
 * es el color **calculado** y que el texto encima se lea.
 */
async function openCategorySheet(page: Page, name: string) {
  await page.goto("/admin/menu/categories");
  await page.getByRole("button", { name: `Editar ${name}` }).click();
  await expect(page.getByLabel("Color de la categoría (opcional)")).toBeVisible();
}

function productCard(page: Page, productName: string) {
  return page.locator("article").filter({ has: page.getByRole("link", { name: `Ver ${productName}` }) });
}

test.describe("color por categoría", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el owner elige el color, la carta lo muestra y se puede sacar", async ({ page }) => {
    await loginAsOwner(page);
    await openCategorySheet(page, "Tacos");

    const colorInput = page.getByLabel("Color de la categoría (opcional)");

    // Un color a medio escribir no se puede guardar, y se explica por qué.
    await colorInput.fill("rojo");
    await expect(page.getByText(/Usá un color en formato #rrggbb/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeDisabled();

    // El color del mock: sobre #d32f2f el texto claro da 4,75:1.
    await colorInput.fill("#d32f2f");
    await expect(page.getByText("Así se lee el texto")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar" })).toBeEnabled();
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    await page.goto("/menu");
    const card = productCard(page, "Taco de Birria").locator("div").first();
    await expect(card).toBeVisible();

    const cardStyle = await card.evaluate((element) => {
      const computed = window.getComputedStyle(element);
      return { backgroundColor: computed.backgroundColor, borderColor: computed.borderColor };
    });
    expect(cardStyle.backgroundColor).toBe("rgb(211, 47, 47)");
    expect(cardStyle.borderColor).toBe("rgb(211, 47, 47)");

    // El texto del nombre va en el color claro del sistema, no en el oscuro.
    const nameColor = await page
      .getByRole("heading", { name: "Taco de Birria" })
      .evaluate((element) => window.getComputedStyle(element).color);
    expect(nameColor).toBe("rgb(247, 250, 252)");

    // Y se puede volver al diseño del sistema.
    await openCategorySheet(page, "Tacos");
    await colorInput.fill("");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();

    await page.goto("/menu");
    const stillTinted = await productCard(page, "Taco de Birria").evaluate((element) =>
      element.innerHTML.includes("rgb(211, 47, 47)"),
    );
    expect(stillTinted).toBe(false);
  });
});
