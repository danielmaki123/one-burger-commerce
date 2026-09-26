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
 * Bloque 9.2 — deja la caja abierta antes de cobrar.
 *
 * Desde ese bloque el cobro **exige** un turno abierto (un cobro con la caja cerrada no entra a
 * ningún arqueo y el servidor lo rechaza con 409). Primero se pregunta si ya hay una caja abierta
 * por API —para no abrir una segunda, que el índice único de la base rechaza— y, si no la hay, se
 * abre contando cero desde la propia pantalla. Es idempotente: el caso que cobra puede correr antes
 * o después del caso que abre y cierra.
 */
async function ensureOpenShift(page: Page) {
  // Tarea 1 del brief (2026-09-17): el POS ya no abre la caja —eso pasó a «Caja»—, así que el arnés la abre
  // por la API (es lo que hace el cajero en la otra pantalla).
  //
  // Fase 6 del rediseño de Caja: el POS hereda la **terminal** del local (la primera activa) y lee la caja de
  // esa estación. Si el arnés dejó una caja abierta «sin terminal» en un local que **tiene** terminales
  // cargadas, el POS no la ve y el cajero no puede cobrar. El estado se resuelve con la misma regla que la
  // pantalla, así que la suite es idempotente y no depende del orden de sus casos.
  const resuelto = await page.evaluate(async () => {
    const locationsResponse = await fetch("/api/admin/locations", { cache: "no-store" });
    const locations = ((await locationsResponse.json()) as {
      data: Array<{ id: string; posEnabled: boolean }>;
    }).data.filter((location) => location.posEnabled);

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
          body: JSON.stringify({
            locationId,
            ...(terminalId ? { terminalId } : {}),
            counts: [],
          }),
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
      // La ruta devuelve `{ terminals }`; el doble del contrato acepta también un arreglo suelto.
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

  await page.reload();
  expect(resuelto, "el arnés tiene que poder dejar una caja abierta para el POS").toBe(true);
  await expect(page.getByText("Caja abierta").first()).toBeVisible();
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

      await expect(page.getByRole("heading", { level: 1, name: "POS" })).toBeVisible();

      // El catálogo llega por la API del POS: se espera al primer producto vendible del seed.
      const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
      await expect(agregar).toBeVisible();

      const boton = await agregar.boundingBox();
      expect(boton!.height).toBeGreaterThanOrEqual(44);

      // La Fase 1 (`SCREEN-POS-QUICK-SALE-001`): en el celular el primer viewport es el **catálogo** y la
      // venta vive en un sheet que se abre desde la barra inferior. El resumen de la barra ya dice el estado.
      const resumen = page.getByRole("region", { name: "Resumen de la venta" });
      await expect(resumen).toContainText("Sin productos");

      await agregar.click();

      await expect(resumen).toContainText("1 producto");
      await expect(resumen).toContainText("C$");

      // `Ver venta` abre el ticket (el sheet de checkout) con las líneas, el desglose y el cobro.
      await page.getByRole("button", { name: /^Ver venta · C\$/ }).click();
      const venta = page.getByRole("dialog", { name: "Venta en curso" });
      await expect(venta).toBeVisible();

      // El desglose muestra subtotal, empaque (cuando lo hay) y el total con la moneda configurada.
      // `exact: true` porque "Total" también matchea "Subtotal" (Playwright no distingue mayúsculas).
      await expect(venta.getByText("Subtotal")).toBeVisible();
      await expect(venta.getByText("Total", { exact: true })).toBeVisible();
      await expect(venta.getByTestId("pos-sale-total")).toContainText("C$");

      // El cobro existe (TASK-303b) y mide el mínimo táctil.
      const cobrar = venta.getByRole("button", { name: /^Cobrar C\$/ });
      await expect(cobrar).toBeVisible();
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
      const venta = page.getByRole("dialog", { name: "Venta en curso" });

      await expect(catalogo).toBeVisible();
      await expect(venta).toBeVisible();

      const cajaCatalogo = await catalogo.boundingBox();
      const cajaVenta = await venta.boundingBox();

      expect(cajaVenta!.x).toBeGreaterThan(cajaCatalogo!.x + cajaCatalogo!.width - 2);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    });
  });

  /**
   * Tareas 9.4 y 9.5 del roadmap del POS (Fase 2) — la venta en espera, en el navegador de verdad.
   *
   * El caso del mostrador: el cliente no está listo y atrás hay otra gente. El cajero deja la venta a un
   * lado, **el mostrador queda libre** para el próximo (la espera vive en el dispositivo, así que una
   * recarga no la pierde) y la retoma entera cuando el cliente vuelve. Se cierra probando la confirmación
   * del descarte, que es lo único que no se deshace: el `<dialog>` nativo solo se comporta en un navegador.
   */
  test("el cajero deja la venta en espera y la retoma cuando el cliente vuelve (9.4/9.5)", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/pos");

    // Una terminal nueva: el borrador que haya dejado otro caso no es de esta venta.
    await page.evaluate(() => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith("one-burger-pos-")) window.localStorage.removeItem(key);
      }
    });
    await page.reload();

    const venta = page.getByRole("dialog", { name: "Venta en curso" });
    const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
    await expect(agregar).toBeVisible();
    const nombre = (await agregar.getAttribute("aria-label"))!
      .replace(/^Agregar /, "")
      .replace(/ a la venta$/, "");
    await agregar.click();
    await venta.getByLabel("Nombre del cliente").fill("Espera E2E");

    // La Fase 1: «En espera» dejó de ser un bloque permanente y vive en su capa, con la cuenta en el
    // disparador. Se abre como lo hace el cajero.
    await venta.getByRole("button", { name: /^En espera \(/ }).click();
    const espera = venta.getByRole("region", { name: "Ventas en espera" });
    const guardar = espera.getByRole("button", { name: "Guardar en espera" });
    const cajaGuardar = await guardar.boundingBox();
    expect(cajaGuardar!.height).toBeGreaterThanOrEqual(44);

    await guardar.click();

    // El mostrador queda libre para el próximo cliente y la venta espera con lo que llevaba.
    await expect(venta.getByText("Sin productos")).toBeVisible();
    await expect(venta.getByRole("list", { name: "Ventas en espera" })).toBeVisible();
    await expect(venta.getByText("Espera E2E")).toBeVisible();
    await expect(venta.getByText(/^1 producto/).first()).toBeVisible();

    // Una recarga no la pierde: la espera está en el dispositivo, no en la memoria de la pantalla.
    await page.reload();
    await page.getByRole("dialog", { name: "Venta en curso" }).getByRole("button", { name: /^En espera \(/ }).click();
    await expect(page.getByRole("list", { name: "Ventas en espera" })).toBeVisible();
    await expect(page.getByText("Espera E2E")).toBeVisible();

    // Retomarla la trae completa (el cliente y su venta).
    await page.getByRole("button", { name: "Retomar la venta de Espera E2E" }).click();
    await expect(page.getByRole("list", { name: "Ventas en espera" })).toBeHidden();
    await expect(page.getByLabel("Nombre del cliente")).toHaveValue("Espera E2E");
    await expect(
      page.getByRole("dialog", { name: "Venta en curso" }).getByText(nombre),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Cobrar C\$/ })).toBeVisible();

    // Descartar pregunta antes, y deja el mostrador limpio (el caso no ensucia la terminal del siguiente).
    await page.getByRole("button", { name: "Guardar en espera" }).click();
    await page.getByRole("button", { name: "Descartar la venta de Espera E2E" }).click();
    // Hay dos `<dialog>` en pantalla (el panel de venta y esta confirmación): se busca la confirmación por su
    // nombre, que es el del título del `Modal`.
    const dialogo = page.getByRole("dialog", { name: "Descartar la venta en espera" });
    await expect(dialogo).toBeVisible();

    // El diálogo sale **centrado** en la pantalla: el modo modal del navegador centra con `margin: auto`
    // y el reset de Tailwind lo borraba (el aviso aparecía pegado a la esquina del panel).
    const cajaDialogo = (await dialogo.boundingBox())!;
    const ancho = page.viewportSize()!.width;
    expect(Math.abs(cajaDialogo.x + cajaDialogo.width / 2 - ancho / 2)).toBeLessThan(40);

    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("list", { name: "Ventas en espera" })).toBeVisible();

    await page.getByRole("button", { name: "Descartar la venta de Espera E2E" }).click();
    await page.getByRole("button", { name: "Sí, descartar" }).click();
    await expect(page.getByText("No hay ventas en espera.")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — el cupón que el cliente trajo, en el navegador de verdad.
   *
   * Se crea una promo real por la API del admin (10 %), el cajero la aplica en el mostrador y el **total
   * baja** antes de cobrar: el número que el cajero le dice al cliente es el que se va a cobrar. Después se
   * prueba el otro lado —un código que no existe— y se borra la promo para no ensuciar la base local.
   */
  test("el cajero aplica una promo y el total baja antes de cobrar (9.6)", async ({ page }) => {
    test.skip(!mutationsAllowed, "Creating a promo is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    const code = `E2E10${Date.now().toString(36).toUpperCase()}`;
    // La promo se crea desde la propia página (mismo origen y misma sesión que el navegador).
    const created = await page.evaluate(async (promoCode) => {
      const response = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode,
          type: "percentage",
          value: 10,
          isActive: true,
          usageLimit: 0,
        }),
      });
      const body = (await response.json()) as { data?: { id: string } };

      return { ok: response.ok, status: response.status, id: body.data?.id ?? null };
    }, code);
    expect(created.ok, `no se pudo crear la promo: ${created.status}`).toBeTruthy();

    try {
      await page.goto("/admin/pos");
      // Una terminal nueva: el borrador que haya dejado otro caso no es de esta venta.
      await page.evaluate(() => {
        for (const key of Object.keys(globalThis.localStorage)) {
          if (key.startsWith("one-burger-pos-")) globalThis.localStorage.removeItem(key);
        }
      });
      await page.reload();

      const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
      await expect(agregar).toBeVisible();
      await agregar.click();

      const totalSinPromo = (await page.getByRole("button", { name: /^Cobrar C\$/ }).textContent())!;

      // La promo vive detrás de su opción (Fase 1): se abre como lo hace el cajero.
      await page.getByRole("button", { name: "Aplicar promo" }).click();
      await page.getByLabel("Código de promo (opcional)").fill(code);
      await page.getByRole("button", { name: "Aplicar", exact: true }).click();

      // La cotización se ve con su descripción y el total ya la tiene descontada.
      await expect(page.getByText("10 % de descuento").first()).toBeVisible();
      const totalConPromo = (await page.getByRole("button", { name: /^Cobrar C\$/ }).textContent())!;
      expect(totalConPromo).not.toBe(totalSinPromo);

      const aNumero = (etiqueta: string) => Number(etiqueta.replace(/[^\d.]/g, ""));
      expect(aNumero(totalConPromo)).toBeLessThan(aNumero(totalSinPromo));
      // El descuento se ve en el desglose (y en el resumen del cupón) con su signo.
      await expect(page.getByText(/^−C\$/).first()).toBeVisible();

      // Un código que no existe se dice sin tocar el total, y la promo se puede quitar.
      await page.getByRole("button", { name: /^Quitar promo / }).click();
      await page.getByLabel("Código de promo (opcional)").fill("NOEXISTE");
      await page.getByRole("button", { name: "Aplicar", exact: true }).click();
      await expect(page.getByText("Ese código no existe.")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Cobrar C\$/ })).toHaveText(totalSinPromo);
    } finally {
      if (created.id) {
        await page.evaluate(async (promotionId) => {
          await fetch(`/api/admin/promotions/${promotionId}`, { method: "DELETE" });
        }, created.id);
      }
    }
  });

  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual con permiso**, en el navegador de verdad.
   *
   * El dueño (que puede darlo) ve el control, lo aplica con su motivo y el total baja antes de cobrar; el
   * cajero no lo ve (eso lo mide `admin-cashier.spec.ts`). El caso no cobra nada: no toca la base.
   */
  test("el dueño aplica un descuento manual y el total baja (9.7)", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/pos");

    // Una terminal nueva: el borrador que haya dejado otro caso no es de esta venta.
    await page.evaluate(() => {
      for (const key of Object.keys(globalThis.localStorage)) {
        if (key.startsWith("one-burger-pos-")) globalThis.localStorage.removeItem(key);
      }
    });
    await page.reload();

    const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
    await expect(agregar).toBeVisible();
    await agregar.click();

    const totalSinDescuento = (await page.getByRole("button", { name: /^Cobrar C\$/ }).textContent())!;

    // El descuento manual vive detrás de su opción (Fase 1): se abre como lo hace el dueño.
    await page.getByRole("button", { name: "Aplicar descuento" }).click();
    const descuento = page.getByRole("region", { name: "Descuento manual" });
    await expect(descuento).toBeVisible();
    await descuento.getByLabel("Descuento (%)").fill("10");
    await descuento.getByLabel("Motivo del descuento").fill("Cliente de siempre");
    await descuento.getByRole("button", { name: "Aplicar descuento" }).click();

    await expect(page.getByText("Descuento manual · 10 %").first()).toBeVisible();
    await expect(page.getByText("Cliente de siempre").first()).toBeVisible();

    const totalConDescuento = (await page.getByRole("button", { name: /^Cobrar C\$/ }).textContent())!;
    const aNumero = (etiqueta: string) => Number(etiqueta.replace(/[^\d.]/g, ""));
    expect(aNumero(totalConDescuento)).toBeLessThan(aNumero(totalSinDescuento));

    // El descuento se puede quitar: el total vuelve al de antes y la venta queda limpia.
    await page.getByRole("button", { name: "Quitar descuento manual" }).click();
    await expect(page.getByRole("button", { name: /^Cobrar C\$/ })).toHaveText(totalSinDescuento);
    await page.getByRole("button", { name: /^Sacar / }).first().click();
  });

  test("el cajero cobra la venta y el pedido llega a comandas", async ({ page }) => {    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);
    await page.goto("/admin/pos");
    await ensureOpenShift(page);
    await addFirstProduct(page);

    // Se paga el doble del total mostrado, para que haya cambio que verificar.
    const etiqueta = await page.getByRole("button", { name: /^Cobrar C\$/ }).textContent();
    const total = Number((etiqueta ?? "").replace(/[^\d.]/g, ""));
    expect(total).toBeGreaterThan(0);

    await page.getByLabel("Nombre del cliente").fill("Cliente POS E2E");
    await page.getByLabel("Número del cliente").fill("88887777");
    await page.getByLabel("Con cuánto paga").fill(String(total * 2));
    await page.getByRole("button", { name: /^Cobrar C\$/ }).click();

    const confirmacion = page.getByRole("status").last();
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

    // Bloque 10.2: el ticket de cliente se imprime con la hoja del sistema. Es el comprobante, así que
    // lleva el número, el total cobrado y con qué pagó — lo contrario del de cocina, que va sin importes.
    const [ticket] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Ticket de cliente" }).click(),
    ]);
    await ticket.waitForLoadState("domcontentloaded");
    const papel = (await ticket.locator("pre").textContent()) ?? "";

    expect(papel).toContain("TICKET DE CLIENTE");
    expect(papel).toContain(`Pedido ${numero}`);
    expect(papel).toContain("Total C$");
    expect(papel).toContain("Efectivo C$");
    expect(papel).toContain("Cambio C$");
    await ticket.close();

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

    // Bloque 10.4: y desde el detalle del pedido se **reimprime** el mismo ticket, con los datos que la
    // pantalla ya cargó (ítems, totales y cobros). Sin el precio unitario —el `lineTotal` incluye
    // empaque y modificadores, dividirlo daría un número falso— pero con el total y el medio de pago.
    const [reimpresion] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Reimprimir ticket" }).click(),
    ]);
    await reimpresion.waitForLoadState("domcontentloaded");
    const reimpreso = (await reimpresion.locator("pre").textContent()) ?? "";

    expect(reimpreso).toContain(`Pedido ${numero}`);
    expect(reimpreso).toContain("TICKET DE CLIENTE");
    expect(reimpreso).toContain("Total C$");
    expect(reimpreso).toContain("Efectivo C$");
    await reimpresion.close();
  });

  /**
   * Punto 4 del roadmap (2026-09-18) — el cliente que pide **factura con RUC**.
   *
   * El recorrido entero, en un navegador real: el cajero marca el tilde, carga el RUC y la razón social, y
   * la venta sale. Después, desde el **detalle del pedido** (donde el RUC no viaja en el body), la factura
   * tiene que salir **con el RUC del cliente**: es el respaldo que se agregó por esto mismo.
   */
  test("el cliente pide factura con RUC y la factura sale con sus datos (Punto 4)", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);
    await page.goto("/admin/pos");
    await ensureOpenShift(page);
    await addFirstProduct(page);

    const etiqueta = await page.getByRole("button", { name: /^Cobrar C\$/ }).textContent();
    const total = Number((etiqueta ?? "").replace(/[^\d.]/g, ""));
    expect(total).toBeGreaterThan(0);

    await page.getByLabel("Nombre del cliente").fill("Distribuidora La Unión");
    await page.getByLabel("Número del cliente").fill("88887777");
    await page.getByLabel("Con cuánto paga").fill(String(total));

    // Con el tilde puesto, el RUC y la razón social son obligatorios: con el RUC corto el cobro no sale.
    await page.getByLabel("Cliente pide factura con RUC").check();
    await page.getByLabel("RUC (mínimo 8 caracteres)").fill("J0310");
    await page.getByLabel("Razón social").fill("Distribuidora La Unión");
    await page.getByRole("button", { name: /^Cobrar C\$/ }).click();
    await expect(page.getByText("Revisá los datos marcados.")).toBeVisible();

    await page.getByLabel("RUC (mínimo 8 caracteres)").fill("J0310000001");
    await page.getByRole("button", { name: /^Cobrar C\$/ }).click();

    const confirmacion = page.getByRole("status").last();
    await expect(confirmacion).toContainText("Venta P-");
    const numero = (await confirmacion.textContent())?.match(/P-[A-Z0-9]+/)?.[0];
    expect(numero, "la confirmación trae el número de pedido").toBeTruthy();

    // Y la factura del pedido sale con el RUC del cliente, emitida desde el detalle.
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: /Abrir orden/ }).filter({ hasText: numero! }).first().click();

    await page.getByRole("button", { name: "Emitir factura" }).click();
    // El panel de la factura imprime el RUC y la razón social del cliente: salieron del `Customer`, no del
    // body de la emisión (el detalle no los pide cuando ya están guardados).
    await expect(page.getByText("RUC J0310000001")).toBeVisible();
    await expect(page.getByText("Distribuidora La Unión").first()).toBeVisible();
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
    const caja = page.getByRole("region", { name: "Caja del local" });

    // Tarea 1 del brief: la caja se abre y se cierra en su pantalla, no en el POS.
    await page.goto("/admin/cash");

    // El panel **lee el turno del servidor**: se espera a que dibuje su acción antes de decidir. Sin
    // esto, el `count()` de abajo ve 0 mientras carga, se saltea el cierre y la caja que dejó abierta
    // otra spec queda abierta: el test después buscaba «Abrir caja» con una caja ya abierta y fallaba.
    const accionCaja = caja.getByRole("button", { name: /^(Abrir|Cerrar) caja$/ });
    await expect(accionCaja).toBeVisible();

    // Estado de partida: si una corrida anterior dejó la caja abierta, se cierra contando cero (deja
    // una diferencia, que es un dato del test, no del producto). Desde la Fase 3 del rediseño de Caja el
    // cierre pasa por un modal: el botón de la sección lo abre y el cierre se firma adentro.
    if ((await accionCaja.textContent())?.includes("Cerrar")) {
      await accionCaja.click();
      await page.getByRole("dialog").getByRole("button", { name: "Cerrar caja" }).click();
      await expect(caja.getByRole("status")).toContainText("Cierre registrado");
      await expect(caja.getByRole("button", { name: "Abrir caja" })).toBeVisible();
    }

    // Abrir contando: 10 × C$100. El fondo lo deriva el servidor.
    await billetes.fill("10");
    await caja.getByRole("button", { name: "Abrir caja" }).click();
    await expect(caja.getByText(/Caja abierta desde/)).toBeVisible();

    // Cerrar contando lo mismo: sin ventas en el turno, no hay diferencia. El conteo del cierre vive en
    // el modal (con el cuadre por banco al lado), no en la página.
    await caja.getByRole("button", { name: "Cerrar caja" }).click();
    const cierre = page.getByRole("dialog");
    await cierre
      .getByRole("spinbutton", { name: "Cantidad de billetes de NIO 100", exact: true })
      .fill("10");
    await cierre.getByRole("button", { name: "Cerrar caja" }).click();

    const resumen = caja.getByRole("status");
    // Tareas 5 y 6 del brief: el operario ve «Cierre registrado» + el id y la diferencia; el dueño
    // (que es quien corre este caso) ve además el arqueo con lo contado y lo esperado.
    await expect(resumen).toContainText("Cierre registrado");
    await expect(resumen).toContainText("diferencia");
    await expect(resumen).toContainText("Contado");
    await expect(resumen).toContainText("esperado");
    await expect(resumen).toContainText("sin diferencia");
  });

  test("sin conexión no se cobra y la venta en curso no se pierde (12.3/12.4)", async ({
    page,
    context,
  }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);
    await page.goto("/admin/pos");
    await ensureOpenShift(page);
    await addFirstProduct(page);

    // La venta armada, medida por el resumen de la venta (el conteo de líneas).
    const resumenVenta = page.getByTestId("pos-sale-lines-count");
    await expect(resumenVenta).toHaveText("1 producto");

    // 12.3: la recarga del navegador (corte de luz, F5 sin querer) no se lleva la venta armada.
    await page.reload();
    await expect(page.getByText(/Recuperamos la venta que estaba en curso/)).toBeVisible();
    await expect(resumenVenta).toHaveText("1 producto");

    // 12.4: sin red, el cobro se bloquea con el motivo escrito (un cobro que no se registra es un
    // pedido perdido) y la venta queda guardada en el dispositivo.
    await context.setOffline(true);
    await expect(page.getByText(/Sin conexión: el cobro no se va a registrar/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Cobrar C\$/ })).toBeDisabled();

    // Y al volver la conexión se puede cobrar lo que quedó armado. Se espera a que el aviso se **vaya**
    // antes de mirar el botón: la transición de vuelta pasa por el mismo estado que la de ida, y el
    // navegador no borra la clase `disabled` en el mismo frame en que vuelve `online`.
    await context.setOffline(false);
    await expect(page.getByText(/Sin conexión: el cobro no se va a registrar/)).toBeHidden();
    await expect(page.getByRole("button", { name: /^Cobrar C\$/ })).toBeEnabled();
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
    await expect(page.getByRole("heading", { level: 1, name: "POS" })).toBeVisible();

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
