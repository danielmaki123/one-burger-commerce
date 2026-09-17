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

/**
 * TASK-308 — prende o apaga el punto de venta en **todos** los locales que hagan falta.
 *
 * Se recorre la pantalla real (la ficha del local, que es donde el owner lo hace) y se devuelven los
 * nombres que se tocaron. No se asume cuántos locales hay: la suite crea y borra sucursales, así que
 * preguntar el estado actual es lo único que mantiene el caso repetible.
 */
async function setPosEnabledForEveryLocation(page: Page, enabled: boolean) {
  const names = await page.evaluate(async (expected) => {
    const response = await fetch("/api/admin/locations", { cache: "no-store" });
    const payload = (await response.json()) as {
      data: Array<{ name: string; posEnabled: boolean }>;
    };

    return payload.data
      .filter((location) => location.posEnabled !== expected)
      .map((location) => location.name);
  }, enabled);

  for (const name of names) {
    await page.goto("/admin/locations");
    await expect(page.getByText("Cargando locales…")).toBeHidden();
    await page.getByRole("button", { name: `Editar local ${name}` }).click();
    await page
      .getByRole("combobox", { name: "Punto de venta" })
      .selectOption(enabled ? "yes" : "no");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Local actualizado.")).toBeVisible();
  }

  return names;
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

    // TASK-307: el recibo se genera como imagen en el dispositivo **desde la confirmación del cobro**
    // (es donde está el botón). En Chromium headless no hay hoja de compartir, así que el camino real
    // es la descarga: se comprueba que el JPG sale con su nombre.
    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "Enviar recibo" }).click();
    expect((await descarga).suggestedFilename()).toBe(`recibo-${numero}.jpg`);
    await expect(page.getByText("Recibo listo para enviar o imprimir.")).toBeVisible();

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

    // El arqueo vive plegado en la cabecera (la referencia del POS deja el catálogo a la vista).
    await page.getByRole("button", { name: /Apertura \/ Arqueo/ }).click();

    // Estado de partida: si una corrida anterior dejó la caja abierta, se cierra contando cero (deja
    // una diferencia, que es un dato del test, no del producto).
    if ((await page.getByRole("button", { name: "Cerrar caja" }).count()) > 0) {
      await page.getByRole("button", { name: "Cerrar caja" }).click();
      await expect(caja.getByRole("status")).toContainText("Caja cerrada");
    }

    // Abrir contando: 10 × C$100. El fondo lo deriva el servidor.
    await billetes.fill("10");
    await page.getByRole("button", { name: "Abrir caja" }).click();
    await expect(caja.getByText(/Caja abierta · fondo/)).toBeVisible();

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

  /**
   * TASK-308 — el mostrador se prende por local, de punta a punta.
   *
   * Se apaga el POS en los locales que lo tengan prendido y se comprueban las tres cosas que pidió el
   * owner: la navegación deja de ofrecer «POS», la pantalla por URL directa vuelve a comandas y la API
   * contesta 403 con el motivo (la terminal que tenía la pantalla abierta no puede seguir cobrando).
   * Al final se restaura: el resto de la suite —y esta misma corrida— cuenta con el mostrador prendido.
   */
  test("apagar el punto de venta cierra la caja y su entrada en la navegación", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    // Con mostrador: la entrada está en la navegación y se llega desde ahí (no por URL directa).
    const entradaPos = page.getByRole("link", { name: /^POS/ });
    await expect(entradaPos).toBeVisible();
    await entradaPos.click();
    await expect(page).toHaveURL(/\/admin\/pos$/);
    await expect(page.getByRole("heading", { name: "Punto de venta" })).toBeVisible();

    try {
      const apagados = await setPosEnabledForEveryLocation(page, false);
      expect(apagados.length, "tiene que haber algún local con mostrador").toBeGreaterThan(0);

      // 1) La navegación ya no la ofrece. Se espera a que el menú esté dibujado (Órdenes está) para no
      // confundir "todavía no cargó" con "no corresponde".
      await page.goto("/admin/locations");
      await expect(page.getByRole("link", { name: /^Órdenes/ })).toBeVisible();
      await expect(page.getByRole("link", { name: /^POS/ })).toHaveCount(0);

      // 2) La pantalla no existe sin mostrador: la URL directa vuelve a comandas.
      await page.goto("/admin/pos");
      await expect(page).toHaveURL(/\/admin\/orders$/);

      // 3) La API tampoco deja cobrar ese local.
      const locations = await page.evaluate(async () => {
        const response = await fetch("/api/admin/locations", { cache: "no-store" });
        const payload = (await response.json()) as {
          data: Array<{ id: string; posEnabled: boolean }>;
        };

        return payload.data;
      });
      const apagado = locations.find((location) => !location.posEnabled);
      expect(apagado, "quedó al menos un local con el POS apagado").toBeTruthy();

      const catalogo = await page.evaluate(async (locationId) => {
        const response = await fetch(
          `/api/admin/pos/catalog?locationId=${encodeURIComponent(locationId)}`,
          { cache: "no-store" },
        );

        return {
          status: response.status,
          code: ((await response.json()) as { error?: { code?: string } }).error?.code,
        };
      }, apagado!.id);

      expect(catalogo.status).toBe(403);
      expect(catalogo.code).toBe("FORBIDDEN");
    } finally {
      await setPosEnabledForEveryLocation(page, true);
    }

    // Y vuelve: el interruptor no es de una sola dirección.
    await page.goto("/admin/locations");
    await expect(page.getByRole("link", { name: /^POS/ })).toBeVisible();
  });
});
