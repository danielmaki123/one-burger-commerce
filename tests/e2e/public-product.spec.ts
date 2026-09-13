import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { pickQuickAddProduct, readPublicMenu, type MenuProduct } from "./helpers";

/**
 * T4 — la pantalla del producto, en el orden del mock.
 *
 * El mock ordena: título y descripción, **cantidad**, opciones, notas y un CTA
 * fijo que lleva el importe. Su defecto medido era el input de 1×1 que nadie
 * podía clickear; acá el control real está etiquetado y se maneja con teclado.
 *
 * El producto y su precio salen de `/api/menu` (casos de **solo lectura**): así el mismo caso corre
 * contra la carta real, sin depender del seed local ni del símbolo de moneda configurado.
 */

/** Un producto del catálogo real; se prefiere uno sin opciones obligatorias. */
async function pickProduct(request: APIRequestContext): Promise<MenuProduct> {
  const products = (await readPublicMenu(request)).products;
  const product = pickQuickAddProduct(products) ?? products[0];

  expect(product, "el catálogo tiene que tener al menos un producto").toBeTruthy();

  return product;
}

/** El importe del CTA, como número: sirve con cualquier moneda y cualquier símbolo. */
async function ctaAmount(page: Page): Promise<number> {
  const text = (await page.getByRole("button", { name: /Agregar al carrito/ }).textContent()) ?? "";
  const amount = Number(text.replace(/[^\d.]/g, ""));

  expect(Number.isFinite(amount), `el CTA tiene que mostrar un importe (texto: "${text}")`).toBe(
    true,
  );

  return amount;
}

test.describe("producto público", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el CTA fijo lleva el importe y la cantidad lo multiplica", async ({ page, request }) => {
    const product = await pickProduct(request);
    await page.goto(`/menu/${product.id}`);

    const submit = page.getByRole("button", { name: /Agregar al carrito/ });
    await expect(submit).toBeVisible();

    const unitAmount = await ctaAmount(page);
    expect(unitAmount).toBeGreaterThan(0);

    // Control táctil: nunca menos de 44 px de alto.
    const box = await submit.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    expect(await ctaAmount(page)).toBeCloseTo(unitAmount * 2, 2);

    await page.getByRole("button", { name: "Reducir cantidad" }).click();
    expect(await ctaAmount(page)).toBeCloseTo(unitAmount, 2);
  });

  test("el CTA queda fijo abajo mientras se recorren las notas", async ({ page, request }) => {
    const product = await pickProduct(request);
    await page.goto(`/menu/${product.id}`);

    await page.getByLabel("Notas especiales").fill("Sin cebolla, por favor");
    expect(await page.getByLabel("Notas especiales").inputValue()).toBe("Sin cebolla, por favor");

    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await expect(page.getByRole("button", { name: /Agregar al carrito/ })).toBeInViewport();

    const position = await page
      .getByRole("button", { name: /Agregar al carrito/ })
      .evaluate((element) => window.getComputedStyle(element.closest("div[class*='fixed']")!).position);
    expect(position).toBe("fixed");
  });

  test("la cantidad va antes de las notas, como en el mock", async ({ page, request }) => {
    const product = await pickProduct(request);
    await page.goto(`/menu/${product.id}`);

    const quantityBox = await page.getByText("Cantidad").boundingBox();
    const notesBox = await page.getByLabel("Notas especiales").boundingBox();

    expect(quantityBox).not.toBeNull();
    expect(notesBox).not.toBeNull();
    expect(quantityBox!.y).toBeLessThan(notesBox!.y);
  });

  test("el producto se puede agregar y llega al carrito con sus notas", async ({
    page,
    request,
  }) => {
    const product = await pickProduct(request);
    await page.goto(`/menu/${product.id}`);

    await page.getByRole("button", { name: "Aumentar cantidad" }).click();
    await page.getByLabel("Notas especiales").fill("Bien caliente");
    await page.getByRole("button", { name: /Agregar al carrito/ }).click();

    await expect(page.getByText("Agregado al carrito").first()).toBeVisible();

    await page.getByRole("button", { name: /Ver carrito/ }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText(product.name).first()).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});

test.describe("producto público en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("el CTA fijo no se estira a lo ancho de la pantalla (1280 px)", async ({ page, request }) => {
    const product = await pickProduct(request);
    await page.goto(`/menu/${product.id}`);

    const submit = page.getByRole("button", { name: /Agregar al carrito/ });
    await expect(submit).toBeVisible();

    const box = await submit.boundingBox();
    // La barra fija centra su contenido en un ancho máximo legible.
    expect(box!.width).toBeLessThanOrEqual(800);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
