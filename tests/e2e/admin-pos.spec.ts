import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_PASSWORD,
  createAdminUserViaUi,
  loginAsOwner,
  logoutAdmin,
  mutationsAllowed,
} from "./helpers";

/**
 * TASK-302 + TASK-303b — el punto de venta.
 *
 * Lo que se mide de verdad en el navegador: que el catálogo del local llegue a la pantalla, que el
 * total que se muestra sea el que se cobra (con empaque), que los controles táctiles midan lo que
 * tienen que medir y que **cobrar cree el pedido de verdad**: la venta de mostrador se paga en un
 * solo paso y el pedido aparece en comandas.
 */

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** Primer producto vendible del seed, ya en el borrador. */
async function addFirstProduct(page: Page) {
  const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
  await expect(agregar).toBeVisible();
  await agregar.click();
}

test.describe("punto de venta", () => {
  test.describe("en celular", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("se arma la venta con el catálogo del local, sin scroll horizontal", async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/admin/pos");

      await expect(page.getByRole("heading", { name: "Punto de venta" })).toBeVisible();

      // El catálogo llega por la API del POS: se espera al primer producto vendible del seed.
      const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
      await expect(agregar).toBeVisible();

      const boton = await agregar.boundingBox();
      expect(boton!.height).toBeGreaterThanOrEqual(44);

      const venta = page.getByRole("region", { name: "Venta en curso" });
      await expect(venta.getByText("Agregá productos del catálogo para armar la venta.")).toBeVisible();

      await agregar.click();

      await expect(
        venta.getByText("Agregá productos del catálogo para armar la venta."),
      ).toBeHidden();
      // El desglose muestra subtotal, empaque (cuando lo hay) y el total con la moneda configurada.
      // `exact: true` porque "Total" también matchea "Subtotal" (Playwright no distingue mayúsculas).
      await expect(venta.getByText("Subtotal")).toBeVisible();
      await expect(venta.getByText("Total", { exact: true })).toBeVisible();
      await expect(venta.locator("dd[aria-live='polite']")).toContainText("C$");

      // El cobro existe (TASK-303b) y mide el mínimo táctil.
      const cobrar = page.getByRole("button", { name: /^Cobrar / });
      const botonCobrar = await cobrar.boundingBox();
      expect(botonCobrar!.height).toBeGreaterThanOrEqual(44);

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  });

  test.describe("en escritorio", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("el catálogo y la venta conviven en dos columnas", async ({ page }) => {
      await loginAsOwner(page);
      await page.goto("/admin/pos");

      const catalogo = page.getByRole("region", { name: "Catálogo" });
      const venta = page.getByRole("region", { name: "Venta en curso" });

      await expect(catalogo).toBeVisible();
      await expect(venta).toBeVisible();

      const cajaCatalogo = await catalogo.boundingBox();
      const cajaVenta = await venta.boundingBox();

      expect(cajaVenta!.x).toBeGreaterThan(cajaCatalogo!.x + cajaCatalogo!.width - 2);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  });

  test("el cajero cobra la venta y el pedido llega a comandas", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);
    await page.goto("/admin/pos");
    await addFirstProduct(page);

    // Se paga el doble del total mostrado, para que haya cambio que verificar.
    const etiqueta = await page.getByRole("button", { name: /^Cobrar / }).textContent();
    const total = Number((etiqueta ?? "").replace(/[^\d.]/g, ""));
    expect(total).toBeGreaterThan(0);

    await page.getByLabel("Nombre del cliente").fill("Cliente POS E2E");
    await page.getByLabel("Número del cliente").fill("88887777");
    await page.getByLabel("Con cuánto paga").fill(String(total * 2));
    await page.getByRole("button", { name: /^Cobrar / }).click();

    const confirmacion = page.getByRole("status");
    await expect(confirmacion).toContainText("Venta P-");
    await expect(confirmacion).toContainText("Cambio");

    const numero = (await confirmacion.textContent())?.match(/P-[A-Z0-9]+/)?.[0];
    expect(numero, "la confirmación trae el número de pedido").toBeTruthy();

    // El camino real: el pedido cobrado en el mostrador está en el tablero de la cocina...
    await page.goto("/admin/orders");
    await expect(page.getByText(numero!)).toBeVisible();

    // ...y **avanza con las mismas reglas** que uno del checkout (TASK-304): se acepta desde la fila.
    const acciones = page.getByRole("group", { name: `Acciones de la orden ${numero}` });
    await acciones.getByRole("button", { name: "Aceptar" }).click();
    await expect(acciones.getByRole("button", { name: "Preparando" })).toBeVisible();

    // Y la caja ve lo que cobró, con el medio y la moneda (TASK-304). Se abre por **número**: el
    // nombre del cliente se repite entre corridas y el locator tiene que ser uno solo.
    await page.getByRole("link", { name: /Abrir orden/ }).filter({ hasText: numero! }).first().click();
    await expect(page.getByText("Cobrado en el mostrador")).toBeVisible();
    await expect(page.getByText(/Efectivo C\$/)).toBeVisible();
  });

  test("la caja se abre y se cierra contando billetes (TASK-305b)", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);
    await page.goto("/admin/pos");

    // `exact` porque "NIO 100" también matchea "NIO 1000" (Playwright busca por substring).
    const billetes = page.getByRole("spinbutton", {
      name: "Cantidad de billetes de NIO 100",
      exact: true,
    });
    const caja = page.getByRole("region", { name: "Caja" });

    // Estado de partida: si una corrida anterior dejó la caja abierta, se cierra contando cero (deja
    // una diferencia, que es un dato del test, no del producto).
    if ((await page.getByRole("button", { name: "Cerrar caja" }).count()) > 0) {
      await page.getByRole("button", { name: "Cerrar caja" }).click();
      await expect(caja.getByRole("status")).toContainText("Caja cerrada");
    }

    // Abrir contando: 10 × C$100. El fondo lo deriva el servidor.
    await billetes.fill("10");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(caja.getByText(/Abierta · fondo/)).toBeVisible();

    // Cerrar contando lo mismo: sin ventas en el turno, no hay diferencia.
    await billetes.fill("10");
    await page.getByRole("button", { name: "Cerrar caja" }).click();

    const resumen = caja.getByRole("status");
    await expect(resumen).toContainText("Caja cerrada");
    await expect(resumen).toContainText("esperado");
    await expect(resumen).toContainText("sin diferencia");
  });

  test("cocina no entra al punto de venta (vuelve a comandas)", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    const email = `cocina-pos-${Date.now()}@example.com`;
    await createAdminUserViaUi(page, {
      name: "Cocina POS",
      email,
      password: ADMIN_PASSWORD,
      role: "kitchen",
    });

    await logoutAdmin(page);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);

    await page.goto("/admin/pos");
    await expect(page).toHaveURL(/\/admin\/orders$/);
  });
});
