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

    // A-07: la dirección se mudó a la tarjeta de la sucursal (sale de `/api/locations`); acá
    // queda el contacto del negocio. La dirección ya no se repite en las dos superficies.
    const locations = await page.evaluate(async () => {
      const res = await fetch("/api/locations");
      const payload = (await res.json()) as {
        data: { addressLine: string | null; city: string | null }[];
      };
      return payload.data;
    });
    const addressParts = [locations[0].addressLine, locations[0].city].filter(Boolean);
    for (const part of addressParts) {
      await expect(page.getByText(String(part)).first()).toBeVisible();
    }

    await expect(page.getByText("Contacto")).toBeVisible();

    const call = page.getByRole("link", { name: /Llamar/ });
    await expect(call).toHaveAttribute("href", /^tel:\+\d+$/);

    // Cada sucursal con dirección ofrece su "Cómo llegar" a un destino absoluto.
    const directions = page.getByRole("link", { name: /Cómo llegar/ });
    await expect(directions.first()).toBeVisible();
    const href = await directions.first().getAttribute("href");
    expect(href ?? "", "el enlace de mapas tiene que ser absoluto").toMatch(/^https:\/\//);
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

  /**
   * A-07 — la información de cada sucursal, contra `/api/locations` de verdad.
   *
   * El seed local tiene un solo local activo, así que la sección tiene que dibujarse igual:
   * con un local también se ve su propia dirección (antes se veía la del negocio).
   */
  test("muestra la información de cada sucursal, no la del negocio (375 px)", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sucursales" })).toBeVisible();

    const locations = await page.evaluate(async () => {
      const res = await fetch("/api/locations");
      const payload = (await res.json()) as { data: { name: string; addressLine: string | null }[] };
      return payload.data;
    });
    expect(locations.length, "el seed tiene que traer al menos un local").toBeGreaterThan(0);

    // El nombre del local sale de la API, no del código.
    await expect(page.getByText(locations[0].name).first()).toBeVisible();

    // Y un local con dirección ofrece "Cómo llegar" a un destino absoluto.
    const directions = page.getByRole("link", { name: /Cómo llegar/ });
    await expect(directions.first()).toBeVisible();
    const href = await directions.first().getAttribute("href");
    expect(href ?? "", "el enlace del local tiene que ser absoluto").toMatch(/^https:\/\//);
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

  /** A-07 — el footer de escritorio también lista las sucursales, no el horario del negocio. */
  test("el footer muestra la información de cada sucursal (1280 px)", async ({ page }) => {
    await page.goto("/menu");

    await expect(page.getByRole("heading", { name: "Sucursales" })).toBeVisible();

    const locations = await page.evaluate(async () => {
      const res = await fetch("/api/locations");
      const payload = (await res.json()) as { data: { name: string }[] };
      return payload.data;
    });
    expect(locations.length).toBeGreaterThan(0);

    const footer = page.locator("footer");
    await expect(footer.getByText(locations[0].name).first()).toBeVisible();
    await expect(footer.getByRole("link", { name: /Cómo llegar/ }).first()).toBeVisible();
  });
});
