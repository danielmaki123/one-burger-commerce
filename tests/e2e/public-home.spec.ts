import { expect, test } from "@playwright/test";

/**
 * T2 — la home adopta el orden del mock (TASK-mock-adoption, ola 1).
 *
 * Se verifica en un navegador real y en los dos anchos que exige el repo: el
 * mock **no tiene versión de escritorio** (su home vive en un marco fijo de
 * 844 px), así que la de 1280 px la diseñamos nosotros y hay que comprobarla.
 */
test.describe("home pública", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el estado del local y el estimado salen de la configuración (375 px)", async ({ page }) => {
    await page.goto("/");

    // El estado operativo es un dato, no un cartel fijo: puede decir Abierto o
    // Cerrado según la hora y el interruptor del admin. El detalle con el
    // horario de hoy se cubre con reloj fijo en los tests unitarios.
    await expect(page.getByText(/^●?(Abierto|Cerrado)$/)).toBeVisible();
    await expect(page.getByText(/Retiro: (lo antes posible|~\d+ min)/)).toBeVisible();
  });

  test("la información del restaurante tiene datos y enlaces que funcionan", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Información del restaurante" })).toBeVisible();
    // La dirección y el horario salen de `/admin/settings`, no del código.
    await expect(page.getByText("Retiro en tienda")).toBeVisible();
    await expect(page.getByText("Horario de atención")).toBeVisible();
    await expect(
      page.getByText(/(\d{2}:\d{2} - \d{2}:\d{2}|\bcerrado\b)/).first(),
    ).toBeVisible();

    const directions = page.getByRole("link", { name: /Cómo llegar/ });
    await expect(directions).toBeVisible();
    const href = await directions.getAttribute("href");
    expect(href ?? "", "el enlace de mapas tiene que ser absoluto").toMatch(/^https:\/\//);

    const call = page.getByRole("link", { name: /Llamar/ });
    await expect(call).toHaveAttribute("href", /^tel:\+\d+$/);
  });

  test("las tarjetas de producto llevan al producto y el '+' cumple el mínimo táctil", async ({
    page,
  }) => {
    await page.goto("/");

    const card = page.getByRole("link", { name: "Ver Taco de Birria" });
    await expect(card).toBeVisible();

    const quickAdd = page.getByRole("button", { name: "Agregar Taco de Birria al carrito" });
    const box = await quickAdd.boundingBox();
    expect(box, "el producto sembrado no tiene opciones: debería poder agregarse").not.toBeNull();
    // El "+" del mock mide 24×24 y no hace nada; el nuestro, 44 px y agrega.
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);

    // La tarjeta entera también lleva al producto (enlace estirado).
    await expect(card).toHaveAttribute("href", "/menu/seed-prod-01");
  });

  test("el '+' agrega al carrito de verdad", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Agregar Taco de Birria al carrito" }).click();
    await expect(page.getByText("Agregado al carrito")).toBeAttached();

    await page.goto("/cart");
    await expect(page.getByText("Taco de Birria").first()).toBeVisible();
  });

  test("el buscador filtra el menú cargado y explica cuando no hay resultados", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Taco de Birria")).toBeVisible();

    const search = page.getByLabel("Buscar en el menú");
    await search.fill("pastor");

    await expect(page.getByText("Taco de Pastor")).toBeVisible();
    await expect(page.getByText("Taco de Birria")).toHaveCount(0);

    await search.fill("sushi");
    await expect(page.getByText(/No encontramos productos/)).toBeVisible();

    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await expect(page.getByText("Taco de Birria")).toBeVisible();
  });

  test("en 375 px no hay scroll horizontal", async ({ page }) => {
    await page.goto("/");

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});

test.describe("home pública en escritorio", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("la grilla usa 4 columnas y entra sin scroll horizontal (1280 px)", async ({ page }) => {
    await page.goto("/");

    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    const boxes = await cards.evaluateAll((elements) =>
      elements.slice(0, 4).map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width) };
      }),
    );

    expect(boxes).toHaveLength(4);
    // Cuatro en la misma fila: mismo `y` y cuatro posiciones distintas.
    expect(new Set(boxes.map((box) => box.y)).size).toBe(1);
    expect(new Set(boxes.map((box) => box.x)).size).toBe(4);
    expect(new Set(boxes.map((box) => box.width)).size).toBe(1);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });

  test("la marca, el estado y el buscador se ven en una sola pasada (1280 px)", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/^●?(Abierto|Cerrado)$/)).toBeVisible();
    await expect(page.getByLabel("Buscar en el menú")).toBeVisible();
  });
});
