import { expect, test } from "@playwright/test";

/**
 * T3 — el menú con la anatomía del mock (TASK-mock-adoption, ola 1).
 *
 * El mock tiene un "+" de 24 px que no agrega nada y un aviso de "Platillo
 * agregado" que nunca aparece. Acá se verifica en navegador real que el "+"
 * agrega, que mide lo que tiene que medir y que el riel de categorías filtra.
 */
test.describe("menú público", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el '+' agrega al carrito, mide 44 px y se anuncia", async ({ page }) => {
    await page.goto("/menu");

    const quickAdd = page.getByRole("button", { name: "Agregar Taco de Birria al carrito" });
    await expect(quickAdd).toBeVisible();

    const box = await quickAdd.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await quickAdd.click();
    await expect(page.getByText("Agregado al carrito")).toBeAttached();

    // Y el pedido está de verdad en el carrito, no solo en la pantalla.
    await page.goto("/cart");
    await expect(page.getByText("Taco de Birria").first()).toBeVisible();
  });

  test("la tarjeta lleva al producto cuando hay que elegir opciones", async ({ page }) => {
    await page.goto("/menu");

    // "Taco de Pastor" (sembrado con un grupo obligatorio) no se puede agregar directo.
    await expect(page.getByRole("button", { name: /Agregar Taco de Pastor/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver Taco de Pastor" })).toHaveAttribute(
      "href",
      "/menu/seed-prod-03",
    );
  });

  test("el riel de categorías sigue filtrando", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Taco de Birria" })).toBeVisible();

    const bebidas = page.getByRole("button", { name: "Bebidas" });
    await bebidas.click();

    await expect(page.getByRole("heading", { name: "Agua de Jamaica" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Taco de Birria" })).toHaveCount(0);
  });

  test("el buscador filtra el menú y queda en 375 px sin scroll horizontal", async ({ page }) => {
    await page.goto("/menu");

    await page.getByPlaceholder("Buscar en el menú").fill("asada");

    await expect(page.getByRole("heading", { name: "Taco de Asada" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Taco de Birria" })).toHaveCount(0);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});

test.describe("menú público en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("las tarjetas se reparten en fila y no hay scroll horizontal (1280 px)", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.locator("article").first()).toBeVisible();

    const boxes = await page.locator("article").evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width) };
      }),
    );

    expect(boxes).toHaveLength(2);
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[0].x).not.toBe(boxes[1].x);
    expect(boxes[0].width).toBe(boxes[1].width);
    expect(boxes[0].width).toBeGreaterThan(200);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
