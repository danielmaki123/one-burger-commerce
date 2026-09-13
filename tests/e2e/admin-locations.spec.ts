import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner } from "./helpers";

/**
 * T8 fase 3 — la pantalla de locales, de punta a punta.
 *
 * El owner crea un local, lo ve en la lista y lo borra. Es el recorrido que antes no existía:
 * hasta ahora los locales solo se podían crear por API. El test deja la base como la
 * encontró (borra lo que creó).
 */
const NAME = "Local de prueba E2E";

async function deleteLocationIfPresent(page: Page) {
  await page.goto("/admin/locations");

  const row = page.getByRole("button", { name: `Editar local ${NAME}` });
  // La lista llega por fetch: sin esperar, una corrida anterior deja el local y el alta
  // siguiente no falla (no hay slug único repetido si cambio el nombre), pero el borrado
  // final podría intentar dos veces.
  await expect(page.getByText("Cargando locales…")).toBeHidden();
  if ((await row.count()) === 0) return;

  await row.first().click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: `Eliminar local ${NAME}` }).click();
  await expect(page.getByText("Local borrado.")).toBeVisible();
}

/**
 * Deja un producto en el estado "como el negocio": sin precio propio, vendible y disponible.
 * Se hace al empezar y al terminar, así la corrida es repetible y la base no se ensucia.
 */
async function resetProduct(page: Page, productName: string) {
  await page.getByRole("button", { name: `Editar ${productName}` }).click();
  await page.getByRole("spinbutton", { name: "Precio en este local" }).fill("");
  await page.getByRole("combobox", { name: "En este local" }).selectOption("yes");
  await page.getByRole("combobox", { name: /Disponibilidad/ }).selectOption("yes");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Producto actualizado.")).toBeVisible();
}

/**
 * Lo que cobra el sitio público por un producto: se lee del botón de agregar, que es el
 * importe que ve el cliente. Requiere que el producto se ofrezca (si el local lo escondió,
 * la pantalla dice "Producto no encontrado" y esto falla a propósito).
 */
async function publicPrice(page: Page, productId: string): Promise<string> {
  await page.goto(`/menu/${productId}`);

  const submit = page.getByRole("button", { name: /Agregar al carrito/ });
  await expect(submit).toBeVisible();

  const text = await submit.innerText();

  return text.match(/C\$[\d.,]+/)?.[0] ?? text;
}

test.describe("locales del admin", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el owner crea un local, lo ve listado y lo borra", async ({ page }) => {
    await loginAsOwner(page);
    await deleteLocationIfPresent(page);

    // 1) Se entra desde la navegación, no por URL directa.
    await page.getByRole("button", { name: "Más" }).click();
    await page.getByRole("link", { name: /Locales/ }).click();
    await expect(page.getByRole("heading", { name: "Locales" })).toBeVisible();

    // El local primario lo creó la migración: la pantalla nunca arranca vacía.
    await expect(page.getByRole("button", { name: "Editar local Principal" })).toBeVisible();

    // 2) Crear.
    await page.getByRole("button", { name: "Nuevo local" }).click();
    await page.getByLabel("Nombre").fill(NAME);
    await page.getByLabel("Identificador para la URL").fill("prueba-e2e");
    await page.getByLabel("Ciudad").fill("Diriamba");
    await page.getByLabel("Minutos de preparación").fill("30");
    await page.getByRole("button", { name: "Crear local" }).click();

    await expect(page.getByText("Local creado.")).toBeVisible();
    const row = page.getByRole("button", { name: `Editar local ${NAME}` });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Diriamba");
    await expect(row).toContainText("preparación 30 min");

    // El formulario avisa si el identificador ya está en uso.
    await page.getByRole("button", { name: "Nuevo local" }).click();
    await page.getByLabel("Nombre").fill("Otro local");
    await page.getByLabel("Identificador para la URL").fill("prueba-e2e");
    await page.getByRole("button", { name: "Crear local" }).click();
    await expect(page.getByText("Revisá los campos marcados.")).toBeVisible();
    await expect(page.getByText(/Ya hay un local con el identificador/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // 3) Borrar: el último local activo no se puede borrar, el nuevo sí.
    await row.click();
    // `window.confirm` del borrado: Playwright lo descarta por defecto.
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: `Eliminar local ${NAME}` }).click();
    await expect(page.getByText("Local borrado.")).toBeVisible();
    await expect(page.getByRole("button", { name: `Editar local ${NAME}` })).toHaveCount(0);

    // 4) Y el primario, que es el único que queda, se rechaza con el motivo.
    await page.getByRole("button", { name: "Editar local Principal" }).click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Eliminar local Principal" }).click();
    await expect(page.getByText(/necesita al menos un local|último local activo/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // La pantalla entra en 375 px sin scroll horizontal.
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });

  test("el catálogo del local cambia lo que ve el cliente (T8 fase 4 y 5)", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/locations");

    // 1) Se entra desde el listado, no por URL directa.
    await page.getByRole("link", { name: "Catálogo de Principal" }).click();
    await expect(page.getByRole("heading", { name: "Principal" })).toBeVisible();

    // Estado conocido de partida: una corrida anterior puede haber dejado una excepción.
    await resetProduct(page, "Taco de Birria");

    // El plato sembrado cuesta C$35 y, sin excepción, se vende acá al precio del negocio.
    const tacoRow = page.getByRole("button", { name: "Editar Taco de Birria" });
    await expect(tacoRow).toContainText("C$35.00");
    await expect(tacoRow).toContainText("Se vende acá");

    // 2) El menú público arranca cobrando el precio del negocio.
    expect(await publicPrice(page, "seed-prod-01")).toBe("C$35.00");

    // 3) Precio propio: el sitio público pasa a cobrar el del local.
    await page.goto("/admin/locations");
    await page.getByRole("link", { name: "Catálogo de Principal" }).click();
    await tacoRow.click();
    await page.getByRole("spinbutton", { name: "Precio en este local" }).fill("42");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Producto actualizado.")).toBeVisible();
    await expect(tacoRow).toContainText("C$42.00 · base C$35.00");

    expect(await publicPrice(page, "seed-prod-01")).toBe("C$42.00");

    // 4) Volver al precio del negocio: el cliente vuelve a ver C$35.
    await page.goto("/admin/locations");
    await page.getByRole("link", { name: "Catálogo de Principal" }).click();
    await tacoRow.click();
    await page.getByRole("button", { name: "Volver al precio base" }).click();
    await expect(page.getByText("Producto actualizado.")).toBeVisible();

    expect(await publicPrice(page, "seed-prod-01")).toBe("C$35.00");

    // 5) Agotado en este local: deja de ofrecerse en el sitio (no es un botón muerto).
    await page.goto("/admin/locations");
    await page.getByRole("link", { name: "Catálogo de Principal" }).click();
    await tacoRow.click();
    await page.getByRole("combobox", { name: /Disponibilidad/ }).selectOption("no");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Producto actualizado.")).toBeVisible();
    await expect(tacoRow).toContainText("Agotado acá");

    await page.goto("/menu/seed-prod-01");
    await expect(page.getByRole("heading", { name: "Producto no encontrado" })).toBeVisible();

    // 6) Y se puede sacar el plato del local sin borrarlo del menú del negocio.
    await page.goto("/admin/locations");
    await page.getByRole("link", { name: "Catálogo de Principal" }).click();
    await tacoRow.click();
    await page.getByRole("combobox", { name: "En este local" }).selectOption("no");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Producto actualizado.")).toBeVisible();
    await expect(tacoRow).toContainText("No se vende acá");

    // 7) Devolverlo deja todo como estaba: se vende, al precio del negocio y sin excepciones.
    await resetProduct(page, "Taco de Birria");
    await expect(tacoRow).toContainText("Se vende acá");

    expect(await publicPrice(page, "seed-prod-01")).toBe("C$35.00");
  });

  test("con dos locales, el checkout deja elegir dónde retirar (T8 fase 6)", async ({ page }) => {
    await loginAsOwner(page);
    await deleteLocationIfPresent(page);

    // Un segundo local, con otra ciudad.
    await page.goto("/admin/locations");
    await page.getByRole("button", { name: "Nuevo local" }).click();
    await page.getByLabel("Nombre").fill(NAME);
    await page.getByLabel("Identificador para la URL").fill("prueba-e2e");
    await page.getByLabel("Ciudad").fill("Diriamba");
    await page.getByRole("button", { name: "Crear local" }).click();
    await expect(page.getByText("Local creado.")).toBeVisible();

    // Y con un precio propio para el plato de prueba: es lo que hace visible que el total del
    // checkout siga al local elegido (el servidor cobra con ese precio).
    await page.getByRole("link", { name: `Catálogo de ${NAME}` }).click();
    await page.getByRole("button", { name: "Editar Taco de Birria" }).click();
    await page.getByRole("spinbutton", { name: "Precio en este local" }).fill("50");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Producto actualizado.")).toBeVisible();

    try {
      await addSeedProductToCart(page);
      await page.goto("/checkout");

      // Con más de un local aparece el selector, con la dirección de cada uno.
      const segundo = page.getByRole("radio", { name: new RegExp(NAME) });
      await expect(page.getByRole("radio", { name: /Principal/ })).toBeVisible();
      await expect(segundo).toBeVisible();

      // Al elegirlo, el punto de retiro es el de ese local.
      await segundo.check();
      const pickupRow = page.getByText("Retirás en").locator("..");
      await expect(pickupRow).toContainText("Diriamba");

      // Y el total pasa al precio de ese local (C$50 en vez de C$35): lo que se muestra es
      // lo que el servidor cobra (gap del total con varios locales).
      await expect(page.getByRole("button", { name: /Confirmar pedido • C\$50\.00/ }).first()).toBeVisible();

      // El pedido va al local que quede elegido al confirmar: se vuelve al principal para no
      // dejarle pedidos al local de prueba (un local con pedidos no se puede borrar).
      await page.getByRole("radio", { name: /Principal/ }).check();
      await expect(page.getByRole("button", { name: /Confirmar pedido • C\$35\.00/ }).first()).toBeVisible();

      await page.locator('input[name="customerName"]').fill("Cliente Local E2E");
      await page.locator('input[name="customerWhatsapp"]').fill("88887777");
      await page.getByRole("button", { name: /Confirmar pedido/ }).click();
      await expect(page).toHaveURL(/\/success\/.+/);

      // La confirmación dice dónde retira (T8 fase 7). El nombre sale del local del pedido,
      // resuelto por el servidor contra la base.
      await expect(page.getByText("Retiro en Principal")).toBeVisible();

      // Y el historial del dispositivo lo guarda: cuando el cliente vuelve sin el link a
      // mano, el pedido guardado sigue diciendo a qué local iba.
      await page.goto("/activity?tab=orders");
      await expect(page.getByText("Retiro en Principal").first()).toBeVisible();

      // La bandeja del admin filtra por local (T8 fase 7): el pedido es del principal.
      // `first()` porque una corrida anterior puede haber dejado otro pedido del mismo cliente.
      await page.goto("/admin/orders");
      const orderRow = page
        .getByRole("link", { name: /Abrir orden/ })
        .filter({ hasText: "Cliente Local E2E" })
        .first();
      await expect(orderRow).toBeVisible();
      await expect(orderRow).toContainText("Principal");

      // El detalle del pedido también dice de qué local sale (T8 fase 7).
      await orderRow.click();
      const pickupSection = page
        .getByRole("heading", { name: "Punto de retiro" })
        .locator("..");
      await expect(pickupSection).toContainText("Principal");

      await page.goto("/admin/orders");
      await page.getByRole("button", { name: "Mostrar filtros" }).click();
      const locationFilter = page.getByLabel("Local");

      // Filtrando por el otro local, el pedido no está. **Se espera a que el refetch termine**
      // (la bandeja publica `aria-busy`): sin eso la lista se desmonta mientras carga y la
      // aserción pasaría sola, que es exactamente como este test dejó de ver el filtro roto.
      await locationFilter.selectOption({ label: NAME });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(orderRow).toHaveCount(0);

      // Y con su local, vuelve.
      await locationFilter.selectOption({ label: "Principal" });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(orderRow).toBeVisible();
    } finally {
      await deleteLocationIfPresent(page);
    }
  });
});
