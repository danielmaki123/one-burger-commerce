import { expect, test, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * B2 — aceptar y rechazar desde la bandeja, en un navegador real.
 *
 * Los unitarios prueban el contrato de la pantalla contra la API; acá se verifica el recorrido
 * completo: un pedido que entra por el checkout del cliente se acepta y avanza **sin abrir el
 * detalle**, y el rechazo queda asentado con su motivo. Es lo que hace la cocina todo el día.
 *
 * Muta datos (crea pedidos y los cambia de estado), así que solo corre con `E2E_ALLOW_MUTATIONS=true`
 * y nunca contra producción.
 */
test.describe("comandas: acciones en la bandeja (B2)", () => {
  test.skip(!mutationsAllowed, "Mutating admin flow: requires E2E_ALLOW_MUTATIONS=true.");

  test.use({ viewport: { width: 1280, height: 900 } });

  /** Crea un pedido por el camino del cliente y devuelve el nombre que lo identifica. */
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

  /**
   * La fila de un pedido concreto: el enlace de la orden y su grupo de acciones comparten el número,
   * que es lo que los ata sin depender del orden en que la API los devuelva.
   */
  async function rowOf(page: Page, customer: string) {
    const link = page.getByRole("link", { name: /Abrir orden/ }).filter({ hasText: customer }).first();
    await expect(link).toBeVisible();

    const orderNumber = (await link.innerText()).split("\n")[0]?.trim() ?? "";
    // El número lo genera el servidor con el prefijo del tipo de pedido (`P-…` para retiro).
    expect(orderNumber).toMatch(/^[A-Z]+-/);

    return page.getByRole("group", { name: `Acciones de la orden ${orderNumber}` });
  }

  test("un pedido nuevo se acepta y avanza a preparación sin abrir el detalle", async ({ page }) => {
    const customer = await createOrder(page, "Cliente B2 aceptar");

    await loginAsOwner(page);
    await page.goto("/admin/orders");

    const actions = await rowOf(page, customer);

    // Un pedido recién entrado solo se puede aceptar o rechazar.
    await expect(actions.getByRole("button", { name: "Aceptar" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Rechazar" })).toBeVisible();

    await actions.getByRole("button", { name: "Aceptar" }).click();

    // La pantalla dice qué pasó y la comanda queda en la etapa siguiente, en su lugar.
    await expect(page.getByTestId("orders-action-notice")).toContainText(/confirmada/i);
    await expect(actions.getByRole("button", { name: "Preparando" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Aceptar" })).toHaveCount(0);

    // Y sigue avanzando: la cocina termina el pedido.
    await actions.getByRole("button", { name: "Preparando" }).click();
    await expect(page.getByTestId("orders-action-notice")).toContainText(/preparando/i);
    await expect(actions.getByRole("button", { name: "Terminado" })).toBeVisible();
  });

  test("el rechazo pide el motivo y el pedido queda cancelado", async ({ page }) => {
    const customer = await createOrder(page, "Cliente B2 rechazo");

    await loginAsOwner(page);
    await page.goto("/admin/orders");

    const actions = await rowOf(page, customer);
    await actions.getByRole("button", { name: "Rechazar" }).click();

    // Sin motivo no sale nada: el motivo es lo que después explica la cancelación.
    await actions.getByRole("button", { name: "Confirmar rechazo" }).click();
    await expect(actions.getByRole("alert")).toContainText(/motivo/i);

    await actions.getByLabel(/motivo del rechazo/i).fill("Se acabó el pan");
    await actions.getByRole("button", { name: "Confirmar rechazo" }).click();

    await expect(page.getByTestId("orders-action-notice")).toContainText(/cancelada/i);
    // La comanda cancelada ya no ofrece acciones: no se puede "des-cancelar" desde la bandeja.
    await expect(actions.getByRole("button", { name: "Aceptar" })).toHaveCount(0);
  });

  test.describe("en el celular de la cocina", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("las acciones entran, se leen y se pueden tocar (375 px)", async ({ page }) => {
      const customer = await createOrder(page, "Cliente B2 celular");

      await loginAsOwner(page);
      await page.goto("/admin/orders");

      const actions = await rowOf(page, customer);
      const accept = actions.getByRole("button", { name: "Aceptar" });

      await expect(accept).toBeVisible();
      // Un dedo en una tablet de pared no acierta a un control de 24 px.
      const box = await accept.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

      // Y la acción funciona igual que en escritorio: no es un botón de adorno.
      await accept.click();
      await expect(page.getByTestId("orders-action-notice")).toContainText(/confirmada/i);
      await expect(actions.getByRole("button", { name: "Preparando" })).toBeVisible();
    });
  });
});
