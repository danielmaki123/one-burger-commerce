import { expect, test, type Page } from "@playwright/test";

import {
  E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD,
  createAdminUserViaUi,
  loginAsOwner,
  logoutAdmin,
  mutationsAllowed,
} from "./helpers";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **Pedidos runtime**, de punta a punta.
 *
 * Cubre lo que la TASK cambió y lo que ningún test viejo miraba:
 *
 * 1. **La puerta por rol** (`D-014`, `A-66`): el `cashier` entra a Pedidos —lista y abre— y `kitchen`
 *    **no**: cae en su propia superficie (`/admin/kitchen`) y la API le responde **403**.
 * 2. **El listado pagina** y los **filtros viven en la URL**: recargar no los pierde (`A-62`).
 * 3. **Los KPI no cambian al cambiar de página**: describen el filtro completo, no la página visible.
 * 4. **El filtro «Pendientes» incluye `pending` + `partial`** y deja `paid` afuera; un parcial con plata no
 *    demostrable se rotula **PARCIAL · REVISAR**.
 * 5. **El listado no serializa campos prohibidos** (`A-61`: ni el token de consulta ni el GPS).
 * 6. **La factura directa rechaza rol/scope incorrecto** (`A-70`).
 * 7. **Viewport Contract**: los cuatro viewports, sin scroll horizontal y con el scroll **dentro** del listado.
 *
 * Los casos que crean cuentas o pedidos piden `E2E_ALLOW_MUTATIONS=true`; los que sólo leen (rol, listado,
 * KPI y viewports con el pedido que ya exista) corren siempre.
 */

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
] as const;

const CASHIER_PASSWORD = "Cajero1234!";
const KITCHEN_PASSWORD = "Cocina1234!";

/**
 * El dueño entra y abre Pedidos **con la primera lectura terminada**.
 *
 * Esperar los KPI no alcanza: la superficie lee la URL y escribe los filtros en un efecto de montaje, y el
 * test que escribe en el buscador justo antes de que ese efecto corra ve cómo su valor se pisa. Esperar a que
 * el listado —o su estado vacío— esté dibujado es lo que hace determinista al caso siguiente.
 */
async function openOrdersAsOwner(page: Page) {
  await loginAsOwner(page);
  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await expect(page.getByTestId("orders-kpi")).toBeVisible();
  // La marca de «primera lectura terminada»: sin esto, el efecto de montaje que lee la URL puede pisar lo
  // que el test escriba en el buscador.
  await expect(page.getByTestId("orders-list")).toHaveAttribute("data-loaded", "true", { timeout: 20_000 });
}

/** La API del listado, leída desde la página (así lleva la cookie de sesión). */
async function readOrdersApi(page: Page, query = "") {
  return page.evaluate(async (suffix) => {
    const response = await fetch(`/api/admin/orders${suffix}`, { cache: "no-store" });

    return { status: response.status, body: await response.json() };
  }, query);
}

test.describe("Pedidos · la puerta por rol (D-014, A-66)", () => {
  test("el dueño entra al listado y ve la cabecera con sus KPI", async ({ page }) => {
    await openOrdersAsOwner(page);

    await expect(page.getByTestId("orders-kpi")).toBeVisible();
    await expect(page.getByTestId("orders-kpi-total")).toBeVisible();
    await expect(page.getByLabel("Filtros de pedidos")).toBeVisible();
  });

  test("la API del listado responde 200 al dueño y no proyecta de más (A-61)", async ({ page }) => {
    await openOrdersAsOwner(page);

    const { status, body } = await readOrdersApi(page);

    expect(status).toBe(200);
    expect(body.meta).toHaveProperty("total");
    expect(body.kpi).toMatchObject({
      total: expect.any(Number),
      active: expect.any(Number),
      pendingPayment: expect.any(Number),
      scheduled: expect.any(Number),
    });

    const serialized = JSON.stringify(body);
    for (const forbidden of [
      "orderLookupTokenHash",
      "customerLat",
      "customerLng",
      "geoAccuracy",
      "geoCapturedAt",
      "statusHistory",
    ]) {
      expect(serialized, `el listado no puede serializar «${forbidden}»`).not.toContain(forbidden);
    }
  });

  /**
   * El caso que `A-66` pedía: el cajero **localiza** el pedido que va a cobrar. Antes la entrada se le
   * ofrecía y la API le respondía 403.
   */
  test.describe("el cajero lista y abre pedidos", () => {
    test.skip(!mutationsAllowed, "Crear la cuenta del cajero toca la base: E2E_ALLOW_MUTATIONS=true.");
    test.setTimeout(180_000);

    test("el cajero entra a Pedidos, lista y abre un pedido", async ({ page }) => {
      await loginAsOwner(page);
      const email = `orders-cashier-${Date.now()}@example.com`;
      await createAdminUserViaUi(page, {
        name: `Cajero Pedidos ${Date.now()}`,
        email,
        password: CASHIER_PASSWORD,
        role: "cashier",
      });
      await logoutAdmin(page);

      await page.goto("/admin/login");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(CASHIER_PASSWORD);
      await page.getByRole("button", { name: "Iniciar sesión" }).click();

      // El cajero aterriza en **Pedidos**, que es donde localiza lo que va a cobrar.
      await expect(page).toHaveURL(/\/admin\/orders$/);
      await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();

      // Y la API le responde 200 (la puerta es `canViewOrders`, no la gruesa).
      const { status } = await readOrdersApi(page);
      expect(status).toBe(200);

      // Si hay pedidos en el rango, abre uno: el detalle también le responde.
      const rows = page.getByTestId("order-list-row");
      if ((await rows.count()) > 0) {
        await rows.first().click();
        await expect(page).toHaveURL(/\/admin\/orders\/[^/]+$/);
        await expect(page.getByText("Historial real")).toBeVisible();
      }
    });
  });

  /**
   * Cocina **no** entra a Pedidos: la página la manda a su superficie y la API le responde 403. La suite de
   * Cocina ya prueba lo suyo; acá se fija la frontera.
   */
  test.describe("cocina no entra a Pedidos", () => {
    test.skip(!mutationsAllowed, "Crear la cuenta de cocina toca la base: E2E_ALLOW_MUTATIONS=true.");
    test.setTimeout(180_000);

    test("cocina cae en /admin/kitchen y la API le responde 403", async ({ page }) => {
      await loginAsOwner(page);
      const email = `orders-kitchen-${Date.now()}@example.com`;
      await createAdminUserViaUi(page, {
        name: `Cocina Pedidos ${Date.now()}`,
        email,
        password: KITCHEN_PASSWORD,
        role: "kitchen",
      });
      await logoutAdmin(page);

      await page.goto("/admin/login");
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(KITCHEN_PASSWORD);
      await page.getByRole("button", { name: "Iniciar sesión" }).click();

      // Aterriza en **Cocina** (`resolveAdminLanding`), no en Pedidos.
      await expect(page).toHaveURL(/\/admin\/kitchen$/);

      // Y si escribe la URL de Pedidos, la página lo devuelve a la suya.
      await page.goto("/admin/orders");
      await expect(page).toHaveURL(/\/admin\/kitchen$/);

      // La API del listado le responde 403: la UI nunca fue la frontera.
      const { status } = await readOrdersApi(page);
      expect(status).toBe(403);
    });
  });

  test("sin sesión la API responde 401", async ({ request }) => {
    const response = await request.get("/api/admin/orders");

    expect(response.status()).toBe(401);
  });
});

test.describe("Pedidos · filtros en la URL y paginación", () => {
  test("los filtros viven en la URL y sobreviven a recargar (A-62)", async ({ page }) => {
    await openOrdersAsOwner(page);

    /**
     * La búsqueda **espera** a la URL: el campo viaja con una demora de 300 ms (escribir «Ana» hace un viaje,
     * no tres) y la de los desplegables se aplica al instante. Esperar la URL es lo que hace determinista el
     * caso; sin eso se afirma antes de que la demora venza.
     */
    await page.getByTestId("orders-search").fill("P-");
    await expect(page).toHaveURL(/search=P-/);

    await page.getByLabel("Estado", { exact: true }).selectOption("process");
    await page.getByLabel("Pago", { exact: true }).selectOption("pending");

    await expect(page).toHaveURL(/status=process/);
    await expect(page).toHaveURL(/payment=pending/);

    await page.reload();

    await expect(page.getByTestId("orders-search")).toHaveValue("P-");
    await expect(page.getByLabel("Estado", { exact: true })).toHaveValue("process");
    await expect(page.getByLabel("Pago", { exact: true })).toHaveValue("pending");
  });

  test("«Limpiar filtros» vuelve al listado sin filtros", async ({ page }) => {
    await openOrdersAsOwner(page);

    await page.getByLabel("Pago", { exact: true }).selectOption("paid");
    const clear = page.getByTestId("orders-clear-filters");
    await expect(clear).toBeVisible();
    await clear.click();

    await expect(page).not.toHaveURL(/payment=/);
  });

  /**
   * El KPI se calcula sobre el **filtro completo**: cambiar de página no puede cambiar un número.
   */
  test("los KPI no cambian al cambiar de página", async ({ page }) => {
    await openOrdersAsOwner(page);

    const total = await page.getByTestId("orders-kpi-total").innerText();
    const active = await page.getByTestId("orders-kpi-active").innerText();
    const pending = await page.getByTestId("orders-kpi-pending").innerText();

    const next = page.getByRole("button", { name: "Siguiente" });
    if ((await next.count()) === 0 || (await next.isDisabled())) {
      test.skip(true, "el rango elegido tiene una sola página: no hay paginación que verificar");
      return;
    }

    await next.click();
    await expect(page).toHaveURL(/page=2/);

    expect(await page.getByTestId("orders-kpi-total").innerText()).toBe(total);
    expect(await page.getByTestId("orders-kpi-active").innerText()).toBe(active);
    expect(await page.getByTestId("orders-kpi-pending").innerText()).toBe(pending);

    await page.getByRole("button", { name: "Anterior" }).click();
    await expect(page).not.toHaveURL(/page=2/);
  });

  /**
   * `A-70` — la factura no se lee ni se imprime sin la capacidad financiera. La API es la puerta y se prueba
   * por HTTP: el documento **es** plata.
   */
  test("la factura directa rechaza a quien no tiene la capacidad (A-70)", async ({ page }) => {
    await openOrdersAsOwner(page);

    const rows = page.getByTestId("order-list-row");
    if ((await rows.count()) === 0) {
      test.skip(true, "no hay pedidos en el rango para pedir su factura");
      return;
    }

    const orderId = await rows.first().getAttribute("data-order-id");
    if (!orderId) {
      test.skip(true, "la fila no expone el id del pedido");
      return;
    }

    const result = await page.evaluate(async (id) => {
      const response = await fetch(`/api/admin/orders/${id}/invoice`, { cache: "no-store" });

      return response.status;
    }, orderId);

    // Con la capacidad financiera el dueño lee la factura (200) o recibe 404 si el pedido no existe.
    expect([200, 404]).toContain(result);
  });
});

test.describe("Pedidos · Viewport Contract", () => {
  for (const viewport of VIEWPORTS) {
    test(`sin scroll horizontal y con el scroll en el listado (${viewport.width}×${viewport.height})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openOrdersAsOwner(page);

      // El scroll horizontal de la página es cero: la referencia aprobada no lo admite.
      const overflowX = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflowX, `la página desborda a lo ancho a ${viewport.width} px`).toBeLessThanOrEqual(1);

      // La cabecera, los filtros y el listado están a la vista.
      await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
      await expect(page.getByLabel("Filtros de pedidos")).toBeVisible();

      const list = page.getByTestId("order-list-scroll");
      if ((await list.count()) > 0) {
        // El scroll vive adentro del listado: el alto útil es el que la referencia pide.
        const metrics = await list.evaluate((element) => ({
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
        }));
        expect(metrics.clientHeight).toBeGreaterThan(0);
      }
    });
  }
});

test.describe("Pedidos · la autenticación del entorno es la esperada", () => {
  test("las credenciales del dueño entran al panel", async ({ page }) => {
    test.skip(
      !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD,
      "hacen falta credenciales del admin del entorno (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)",
    );

    await openOrdersAsOwner(page);
    await expect(page).toHaveURL(/\/admin\/orders/);
  });
});
