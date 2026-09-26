import { expect, test, type Page } from "@playwright/test";

import {
  ADMIN_PASSWORD,
  addCatalogProductToCart,
  loginAsCashier,
  loginAsOwner,
  logoutAdmin,
  mutationsAllowed,
} from "./helpers";

/**
 * Brief «Corrección post-deploy + cierre de Caja» (2026-09-23) — los casos del cierre, en un navegador real y
 * contra datos reales.
 *
 * 1. **H3b** — la confirmación del cliente no tenía camino al seguimiento del pedido.
 * 2. **N2** — el alta pública limitada por tasa decía «revisá los datos» en vez de decir que espere.
 * 3. **H1** — el aviso de dónde aparecen los bancos, en la Caja, antes de abrir el cierre.
 * 4. **A-45** — el arqueo ciego dejó de ser un sello de pantalla: por API, el cajero tampoco ve el esperado.
 *
 * ⚠️ **El caso N3 se retiró con `SCREEN-POS-QUICK-SALE-001.1`** (2026-09-26): cobrar un pedido del menú dejó
 * de vivir en el POS. La capacidad no desaparece —el pedido se cobra desde Órdenes y la factura desde su
 * detalle—, pero su flujo canónico es otro y la búsqueda de pedidos dentro del POS se eliminó a propósito
 * (*one canonical flow*: localizar pedidos pertenece a Órdenes). Su cobertura queda pendiente de la TASK de
 * esa superficie y está anotada en `ops/audit-backlog.md` como `A-67`.
 */

/** Un pedido del menú, hecho por la UI real del cliente, con su número. */
async function createPublicOrder(page: Page) {
  await addCatalogProductToCart(page, page.request);
  await page.goto("/checkout");
  await page.locator('input[name="customerName"]').fill("Cliente Cierre Caja");
  await page.locator('input[name="customerWhatsapp"]').fill("88887777");
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();
  await expect(page).toHaveURL(/\/success\/.+/);

  const numero = (await page.getByText(/^P-[A-Z0-9]+$/).first().textContent())?.trim();

  expect(numero, "la confirmación trae el número de pedido").toBeTruthy();
  return numero!;
}

/**
 * Deja una caja abierta **en la terminal que el POS va a usar** (el cobro del POS la exige).
 *
 * Fase 6 del rediseño de Caja: el POS hereda la primera terminal activa del local. Si la base quedó con una
 * caja abierta «sin terminal» —lo que dejan otras suites—, el POS no la ve y el cobro queda bloqueado; el
 * arnés resuelve el estado con la misma regla que la pantalla.
 */
async function ensureOpenShift(page: Page) {
  const resuelto = await page.evaluate(async () => {
    const locations = (
      (await (await fetch("/api/admin/locations", { cache: "no-store" })).json()) as {
        data: Array<{ id: string; posEnabled: boolean }>;
      }
    ).data.filter((location) => location.posEnabled);

    const shiftOf = async (locationId: string, terminalId: string | null) => {
      const response = await fetch(
        `/api/admin/pos/shift?locationId=${encodeURIComponent(locationId)}${terminalId ? `&terminalId=${encodeURIComponent(terminalId)}` : ""}`,
        { cache: "no-store" },
      );

      return ((await response.json()) as { data?: { id: string } | null }).data ?? null;
    };

    const openShift = async (locationId: string, terminalId: string | null) =>
      (
        await fetch("/api/admin/pos/shift/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, ...(terminalId ? { terminalId } : {}), counts: [] }),
        })
      ).ok;

    for (const location of locations) {
      const terminalsResponse = await fetch(
        `/api/admin/cash/terminals?locationId=${encodeURIComponent(location.id)}`,
        { cache: "no-store" },
      );
      const terminalsBody = terminalsResponse.ok
        ? ((await terminalsResponse.json()) as {
            data?: { terminals?: unknown } | Array<{ id: string; isActive: boolean }>;
          }).data
        : undefined;
      const terminalsRaw = Array.isArray(terminalsBody) ? terminalsBody : terminalsBody?.terminals;
      const terminals = (Array.isArray(terminalsRaw) ? terminalsRaw : []).filter(
        (terminal) => terminal.isActive,
      );

      if (terminals.length > 0) {
        const terminalId = terminals[0]!.id;
        if (await shiftOf(location.id, terminalId)) return true;
        if (await openShift(location.id, terminalId)) return true;
        continue;
      }

      if (await shiftOf(location.id, null)) return true;
      if (await openShift(location.id, null)) return true;
    }

    return false;
  });

  expect(resuelto, "el arnés tiene que poder dejar una caja abierta para el POS").toBe(true);

  await page.reload();
  await expect(page.getByText("Caja abierta").first()).toBeVisible();
}

test.describe("H3b — la confirmación lleva al seguimiento del pedido", () => {
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("«Seguí tu pedido» abre el seguimiento, sin perder las otras salidas (1280 px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const numero = await createPublicOrder(page);

    const seguir = page.getByRole("button", { name: "Seguí tu pedido" });
    await expect(seguir).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver mis pedidos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver a la carta" })).toBeVisible();

    await seguir.click();
    await expect(page).toHaveURL(/\/orders\/track/);

    // El seguimiento es el de siempre (número + WhatsApp): es lo que la confirmación no tenía.
    await expect(page.getByRole("heading", { name: "Estado de tu pedido" })).toBeVisible();
    await expect(page.getByLabel("Número de pedido")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "WhatsApp" })).toBeVisible();
    expect(numero).toMatch(/^P-/);
  });
});

test.describe("N2 — el alta pública limitada por tasa lo dice con todas las letras", () => {
  test("un 429 pide esperar unos segundos; un error real mantiene su mensaje", async ({ page }) => {
    await addCatalogProductToCart(page, page.request);

    // El límite real (10 pedidos por minuto por IP) no se provoca desde el navegador: se responde 429, que
    // es exactamente lo que el servidor manda cuando el límite salta.
    await page.route("**/api/orders", (route) =>
      route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: {} }) }),
    );

    await page.goto("/checkout");
    await page.locator('input[name="customerName"]').fill("Cliente Tasa");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await page.getByRole("button", { name: /Confirmar pedido/ }).click();

    // El aviso del checkout (el `role="alert"` de la pantalla; el otro es el anunciador de Next).
    const aviso = page.locator("#checkout-error");
    await expect(aviso).toContainText("Esperá un momento e intentá de nuevo en unos segundos.");

    // Un error de verdad no se disfraza de espera: mantiene el mensaje genérico de la pantalla.
    await page.unroute("**/api/orders");
    await page.route("**/api/orders", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "No pudimos guardar el pedido." } }),
      }),
    );

    await page.getByRole("button", { name: /Confirmar pedido/ }).click();
    await expect(aviso).toContainText("No pudimos confirmar el pedido");
    await expect(aviso).not.toContainText("Esperá un momento");
  });
});

test.describe("H1 — la Caja avisa dónde aparecen los bancos", () => {
  test("el aviso anticipa el cuadre por banco: está si el local tiene bancos, y no si no tiene", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/cash");

    const aviso = page.getByText("Los bancos configurados aparecen al abrir el cierre.");
    const avisoVisible = (await aviso.count()) > 0;

    // La promesa del aviso, comprobada abriendo el cierre de verdad: los bancos configurados aparecen ahí.
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    await expect(page.getByRole("dialog", { name: "Cerrar caja" })).toBeVisible();

    // El modal siempre dibuja el bloque del cuadre; sin bancos asignados lo dice con todas las letras.
    const sinBancos = (await page.getByText(/Este local no tiene bancos asignados/).count()) > 0;

    // El aviso no miente ni de más ni de menos: aparece exactamente cuando hay bancos que van a salir.
    expect(avisoVisible).toBe(!sinBancos);

    if (avisoVisible) {
      // Y con bancos, el modal los lista de verdad (un monto declarado por banco).
      await expect(page.getByLabel(/Monto declarado de /).first()).toBeVisible();
    }

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("dialog", { name: "Cerrar caja" })).toHaveCount(0);
  });
});

test.describe("A-45 — el arqueo ciego también es una regla de servidor", () => {
  test.skip(!mutationsAllowed, "The cashier account is created through the UI.");

  test("el cajero no lee el esperado del corte X y el dueño sí", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsOwner(page);
    await page.goto("/admin/pos");
    await ensureOpenShift(page);

    const comoDueno = await page.evaluate(async () => {
      const locations = (
        (await (await fetch("/api/admin/locations", { cache: "no-store" })).json()) as {
          data: Array<{ id: string; posEnabled: boolean }>;
        }
      ).data.filter((location) => location.posEnabled);

      // La caja que importa es la de la **terminal** del POS (Fase 6): el corte X sin terminal devuelve el
      // turno «sin terminal», que no es el que el mostrador abre. Se pregunta por la primera activa, igual
      // que la pantalla.
      const terminalsResponse = await fetch(
        `/api/admin/cash/terminals?locationId=${encodeURIComponent(locations[0]!.id)}`,
        { cache: "no-store" },
      );
      const terminalsBody = terminalsResponse.ok
        ? ((await terminalsResponse.json()) as {
            data?: { terminals?: Array<{ id: string; isActive: boolean }> };
          }).data?.terminals
        : undefined;
      const terminalId = terminalsBody?.find((terminal) => terminal.isActive)?.id;

      const response = await fetch(
        `/api/admin/pos/shift/x?locationId=${encodeURIComponent(locations[0]!.id)}${terminalId ? `&terminalId=${encodeURIComponent(terminalId)}` : ""}`,
        { cache: "no-store" },
      );
      return { status: response.status, body: await response.json() };
    });

    expect(comoDueno.status).toBe(200);
    expect(comoDueno.body.data?.expectedAmount).toBeGreaterThanOrEqual(0);

    const email = `cajero-cierre-${Date.now()}@example.com`;
    // `loginAsCashier` entra como dueño para crear la cuenta: hay que soltar la sesión primero (con una
    // sesión abierta, `/admin/login` redirige y el formulario se va del DOM).
    await logoutAdmin(page);
    await loginAsCashier(page, {
      name: "Cajero Cierre",
      email,
      password: ADMIN_PASSWORD,
    });

    const comoCajero = await page.evaluate(async () => {
      const locations = (
        (await (await fetch("/api/admin/locations", { cache: "no-store" })).json()) as {
          data: Array<{ id: string; posEnabled: boolean }>;
        }
      ).data.filter((location) => location.posEnabled);

      // La caja que importa es la de la **terminal** del POS (Fase 6): el corte X sin terminal devuelve el
      // turno «sin terminal», que no es el que el mostrador abre. Se pregunta por la primera activa, igual
      // que la pantalla.
      const terminalsResponse = await fetch(
        `/api/admin/cash/terminals?locationId=${encodeURIComponent(locations[0]!.id)}`,
        { cache: "no-store" },
      );
      const terminalsBody = terminalsResponse.ok
        ? ((await terminalsResponse.json()) as {
            data?: { terminals?: Array<{ id: string; isActive: boolean }> };
          }).data?.terminals
        : undefined;
      const terminalId = terminalsBody?.find((terminal) => terminal.isActive)?.id;

      const response = await fetch(
        `/api/admin/pos/shift/x?locationId=${encodeURIComponent(locations[0]!.id)}${terminalId ? `&terminalId=${encodeURIComponent(terminalId)}` : ""}`,
        { cache: "no-store" },
      );
      return { status: response.status, body: await response.json() };
    });

    // El mismo corte, el mismo turno: lo que cambia es quién pregunta.
    expect(comoCajero.status).toBe(200);
    expect(comoCajero.body.data?.shiftId).toBeTruthy();
    expect("expectedAmount" in comoCajero.body.data).toBe(false);
    expect("expectedByCurrency" in comoCajero.body.data).toBe(false);
    // Su conteo (el fondo) lo sigue viendo: el ciego esconde la comparación, no su caja.
    expect(comoCajero.body.data?.openingAmount).toBeGreaterThanOrEqual(0);
  });
});
