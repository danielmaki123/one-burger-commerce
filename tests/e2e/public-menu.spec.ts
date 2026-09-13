import { expect, test } from "@playwright/test";

import {
  pickProductWithRequiredChoices,
  pickQuickAddProduct,
  pickSearchableProduct,
  readPublicMenu,
} from "./helpers";

/**
 * T3 — el menú con la anatomía del mock (TASK-mock-adoption, ola 1).
 *
 * El mock tiene un "+" de 24 px que no agrega nada y un aviso de "Platillo
 * agregado" que nunca aparece. Acá se verifica en navegador real que el "+"
 * agrega, que mide lo que tiene que medir y que el riel de categorías filtra.
 *
 * Todo se resuelve desde `/api/menu`: son casos de **solo lectura**, así que no pueden depender del
 * seed local (que en producción no existe). Si la carta real no tiene algún tipo de producto, el
 * caso se saltea **diciendo por qué** en vez de fallar por datos.
 */
test.describe("menú público", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el '+' agrega al carrito, mide 44 px y se anuncia", async ({ page, request }) => {
    const product = pickQuickAddProduct((await readPublicMenu(request)).products);
    test.skip(
      !product,
      "la carta no tiene productos sin opciones obligatorias: no hay '+' que verificar",
    );

    await page.goto("/menu");

    const quickAdd = page.getByRole("button", { name: `Agregar ${product!.name} al carrito` });
    await expect(quickAdd).toBeVisible();

    const box = await quickAdd.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    await quickAdd.click();
    await expect(page.getByText("Agregado al carrito")).toBeAttached();

    // Y el pedido está de verdad en el carrito, no solo en la pantalla.
    await page.goto("/cart");
    await expect(page.getByText(product!.name).first()).toBeVisible();
  });

  test("la tarjeta lleva al producto cuando hay que elegir opciones", async ({ page, request }) => {
    const withChoices = pickProductWithRequiredChoices((await readPublicMenu(request)).products);
    test.skip(
      !withChoices,
      "la carta no tiene productos con opciones obligatorias: no hay nada que verificar acá",
    );

    await page.goto("/menu");

    // Primero la tarjeta tiene que estar: sin eso, `toHaveCount(0)` pasa por la carrera de carga
    // (el catálogo se dibuja después del fetch) y la aserción no verifica nada.
    await expect(page.getByRole("link", { name: `Ver ${withChoices!.name}` })).toBeVisible();

    // Un producto que obliga a elegir no se puede agregar directo: la tarjeta lleva al detalle.
    await expect(
      page.getByRole("button", { name: `Agregar ${withChoices!.name} al carrito` }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: `Ver ${withChoices!.name}` })).toHaveAttribute(
      "href",
      `/menu/${withChoices!.id}`,
    );
  });

  test("el riel de categorías sigue filtrando", async ({ page, request }) => {
    const menu = await readPublicMenu(request);
    const category = menu.categories[0];
    const otherCategory = menu.categories.find((entry) => entry.id !== category?.id);
    test.skip(
      !category || !otherCategory,
      "la carta necesita dos categorías con productos para probar el riel",
    );

    const product = category!.products[0];
    const otherProduct = otherCategory!.products[0];

    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: product.name, exact: true })).toBeVisible();

    await page.getByRole("button", { name: category!.name }).click();

    await expect(page.getByRole("heading", { name: product.name, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: otherProduct.name, exact: true })).toHaveCount(0);
  });

  test("el buscador filtra el menú y queda en 375 px sin scroll horizontal", async ({
    page,
    request,
  }) => {
    const products = (await readPublicMenu(request)).products;
    const searchable = pickSearchableProduct(products);
    const other = products.find((product) => product.id !== searchable?.id);
    test.skip(!searchable || !other, "la carta necesita dos productos con nombres distinguibles");

    await page.goto("/menu");

    await page.getByPlaceholder("Buscar en el menú").fill(searchable!.name);

    // Se afirma **dentro de la sección de resultados** (y con `exact`, porque el encabezado
    // "Resultados para “…”" también lleva el nombre buscado): la página puede tener otras secciones
    // —los destacados de la carta real— que no siguen al buscador.
    const results = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /^Resultados/ }) });

    await expect(results.getByRole("heading", { name: searchable!.name, exact: true })).toBeVisible();
    await expect(results.getByRole("heading", { name: other!.name, exact: true })).toHaveCount(0);

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
