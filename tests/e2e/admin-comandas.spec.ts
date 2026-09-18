import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * B3 — el turno como tablero de comandas, en un navegador real.
 *
 * Lo que los tests de jsdom no pueden ver: que en celular se vea **un carril por vez**, que la barra
 * lateral del panel esté escondida en esta vista (y que el enlace para volver exista), y que el
 * tablero ocupe el ancho. Muta datos: solo con `E2E_ALLOW_MUTATIONS=true`, nunca contra producción.
 */
test.describe("comandas: el tablero del turno (B3)", () => {
  test.skip(!mutationsAllowed, "Mutating admin flow: requires E2E_ALLOW_MUTATIONS=true.");

  test.use({ viewport: { width: 1280, height: 900 } });

  async function createOrder(page: Page, label: string): Promise<string> {
    const customer = `${label} ${Date.now()}`;

    await page.goto("/menu");
    await addSeedProductToCart(page);
    await page.goto("/checkout");
    await page.locator('input[name="customerName"]').fill(customer);
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(page).toHaveURL(/\/success\/.+/);

    return customer;
  }

  async function openBoard(page: Page) {
    await loginAsOwner(page);
    await page.goto("/admin/orders");
    await expect(page.getByTestId("comandas-topbar")).toBeVisible();
  }

  test("el pedido que entra cae en «Por aceptar» y avanza de carril al aceptarlo", async ({ page }) => {
    const customer = await createOrder(page, "Cliente B3 tablero");
    await openBoard(page);

    // Tres carriles, con su cuenta, y la barra del turno con los contadores y la salida al panel.
    await expect(page.getByRole("heading", { name: /Por aceptar \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /En preparación \(\d+\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Listas \(\d+\)/ })).toBeVisible();

    const topbar = page.getByTestId("comandas-topbar");
    await expect(topbar).toContainText("Nuevas");
    await expect(topbar).toContainText("Preparando");
    await expect(topbar).toContainText("Listas");
    // El modo cocina se prende desde la barra del turno (Punto 3): es lo que esconde el chrome.
    await expect(page.getByRole("button", { name: "Modo cocina" })).toBeVisible();

    // La comanda está en el carril de lo que nadie aceptó todavía.
    const pending = page.getByRole("region", { name: "Por aceptar" });
    const card = pending.locator("article").filter({ hasText: customer });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Entró \d/);

    await card.getByRole("button", { name: "Aceptar" }).click();

    // Al aceptarla se va del carril de nuevas: ya es trabajo de cocina.
    await expect(
      page.getByRole("region", { name: "En preparación" }).locator("article").filter({ hasText: customer }),
    ).toBeVisible();
    await expect(pending.locator("article").filter({ hasText: customer })).toHaveCount(0);
  });

  test("la vista ocupa el ancho: la barra lateral del panel queda escondida (B3)", async ({ page }) => {
    await openBoard(page);

    // El layout unificado (2026-09-18) dejó el chrome visible por defecto: esconderlo es el modo
    // cocina (Punto 3), no la entrada a Órdenes.
    await expect(page.locator(".admin-sidebar-shell")).toBeVisible();

    await page.getByRole("button", { name: "Modo cocina" }).click();

    await expect(page.locator(".admin-sidebar-shell")).toBeHidden();
  });

  /**
   * B6 · Punto 3 — el modo cocina y su vuelta.
   *
   * La cocina quiere la tablet de pared sin la navegación del panel, con los carriles ocupando la
   * pantalla. El modo se prende a propósito, tiene sus propios tabs de estado (sin «Cerradas» y sin
   * «Historial») y se sale con **«Salir»**, que devuelve la barra lateral **sin cerrar sesión**: la
   * sesión vive ahí. La elección queda guardada en el dispositivo, así que la tablet vuelve a entrar
   * en modo cocina al recargar.
   */
  test("el modo cocina esconde el chrome y «Salir» lo devuelve sin cerrar sesión (Punto 3)", async ({
    page,
  }) => {
    await openBoard(page);

    await expect(page.locator(".admin-sidebar-shell")).toBeVisible();
    await page.getByRole("button", { name: "Modo cocina" }).click();

    // Sin barra lateral ni encabezado, y con los cinco tabs de la cocina en la barra.
    await expect(page.locator(".admin-sidebar-shell")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Órdenes", exact: true })).toBeHidden();
    await expect(page.getByTestId("kitchen-tab-dispatched")).toBeVisible();
    await expect(page.getByTestId("kitchen-tab-all")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);

    // El tab de la cocina filtra el tablero: «Despachadas hace poco» no es un carril.
    await page.getByTestId("kitchen-tab-dispatched").click();
    await expect(page.getByRole("heading", { name: /Por aceptar \(0\)/ })).toBeVisible();

    await page.getByRole("button", { name: "Salir" }).click();

    await expect(page.locator(".admin-sidebar-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    await expect(page.getByTestId("comandas-topbar")).toBeVisible();
    // Sigue adentro: salir del modo cocina no es salir de la sesión, y **olvida** la preferencia
    // (salir es una decisión de la persona, no de la tablet).
    await expect(page).toHaveURL(/\/admin\/orders/);

    // Y al volver a prenderlo, la tablet queda en modo cocina: la preferencia sobrevive a recargar.
    await page.getByRole("button", { name: "Modo cocina" }).click();
    await expect(page.getByTestId("kitchen-tab-dispatched")).toBeVisible();

    await page.reload();

    await expect(page.getByTestId("kitchen-tab-dispatched")).toBeVisible();
    await expect(page.locator(".admin-sidebar-shell")).toBeHidden();

    // Se apaga al final para no dejar el resto de la suite en modo cocina.
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.getByTestId("comandas-topbar")).toBeVisible();
  });

  test("buscar deja solo la comanda que se está preguntando y lo deja en la URL (B4)", async ({ page }) => {
    // Un nombre irrepetible: la base local acumula pedidos de corridas anteriores.
    const customer = await createOrder(page, "Cliente B4 busqueda");
    await openBoard(page);

    const search = page.getByLabel("Buscar comanda");
    await search.fill(customer);

    const pending = page.getByRole("region", { name: "Por aceptar" });
    await expect(pending.locator("article")).toHaveCount(1);
    await expect(pending.locator("article")).toContainText(customer);

    // El filtro queda en la URL: se puede mandar el enlace a la cocina o recargar sin perderlo.
    await expect(page).toHaveURL(/search=Cliente\+B4\+busqueda/);

    // Lo que no existe no deja una pantalla vacía: lo dice el carril.
    await search.fill("no-existe-esta-comanda");
    await expect(
      pending.getByText(/Ninguna comanda de este carril coincide con «no-existe-esta-comanda»\./),
    ).toBeVisible();

    // Y limpiar los filtros devuelve el turno completo.
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(search).toHaveValue("");
    await expect(page).not.toHaveURL(/search=/);
  });

  test.describe("en el celular de la cocina", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("se ve un carril por vez y el conmutador cambia de carril (375 px)", async ({ page }) => {
      await openBoard(page);

      const switcher = page.getByRole("group", { name: "Carril de comandas" });
      await expect(switcher).toBeVisible();

      // Arranca en "Por aceptar": los otros dos carriles no se ven (no es que estén vacíos).
      await expect(page.getByRole("heading", { name: /Por aceptar \(\d+\)/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /En preparación \(\d+\)/ })).toBeHidden();

      await switcher.getByRole("button", { name: /^En preparación \d+$/ }).click();

      await expect(page.getByRole("heading", { name: /En preparación \(\d+\)/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Por aceptar \(\d+\)/ })).toBeHidden();
    });
  });
});
