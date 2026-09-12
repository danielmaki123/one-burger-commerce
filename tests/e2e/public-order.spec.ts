import { expect, test, type Locator, type Page } from "@playwright/test";

import { addSeedProductToCart, loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Contrato del checkout tras TASK-checkout-ux: cada cosa una sola vez y un solo CTA
 * visible por ancho de pantalla.
 *
 * Se verifica en un navegador real a propósito. `getByRole` ignora lo que está oculto
 * por CSS, así que "un solo botón" se afirma directamente; antes hacía falta
 * `.filter({ visible: true }).first()` para desambiguar los duplicados del bug.
 */
function confirmButton(page: Page): Locator {
  return page.getByRole("button", { name: /Confirmar pedido/ });
}

async function openCheckoutWithOneProduct(page: Page) {
  await page.goto("/menu");
  await addSeedProductToCart(page);
  await page.goto("/checkout");
}

test.describe("checkout sin redundancias", () => {
  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("no repite encabezados, totales ni botones", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    await expect(page.getByRole("heading", { name: "Confirmá tu pedido" })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Resumen del pedido" })).toHaveCount(1);
    await expect(confirmButton(page)).toHaveCount(1);
    await expect(page.getByText("Total a pagar")).toHaveCount(1);
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toHaveCount(1);
  });

  test("el retiro arranca sin programar y se puede programar", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    // Por defecto no se programa nada, y el control muestra el estado en vez de esconderlo.
    // Los radios de la forma de pago (T11) son otro control: el que no está es el del turno.
    const schedule = page.getByRole("button", { name: /^Retiro Lo antes posible · listo ~/ });
    await expect(schedule).toBeVisible();
    await expect(page.locator('input[name="pickupTimeOption"]')).toHaveCount(0);

    await schedule.click();
    await expect(page.getByRole("radio", { name: "Lo antes posible" })).toBeChecked();

    // Los turnos son los del horario configurado, calculados desde ahora + preparación.
    const slots = page.locator('input[name="pickupTimeOption"]');
    const slotCount = await slots.count();
    test.skip(slotCount < 2, "El local demo no tiene turnos disponibles a esta hora.");

    await slots.nth(slotCount - 1).click();
    // Al elegir, el control colapsa y muestra la hora elegida.
    await expect(page.locator('input[name="pickupTimeOption"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Retiro programado \d/ }),
    ).toBeVisible();
  });

  test("el pedido programado llega al admin como programado", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    await page.getByRole("button", { name: /^Retiro Lo antes posible · listo ~/ }).click();
    const slots = page.locator('input[name="pickupTimeOption"]');
    const slotCount = await slots.count();
    test.skip(slotCount < 2, "El local demo no tiene turnos disponibles a esta hora.");
    await slots.nth(slotCount - 1).click();

    await page.locator('input[name="customerName"]').fill("Cliente Programado");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await confirmButton(page).click();
    await expect(page).toHaveURL(/\/success\/.+/);

    // El cliente ve para cuándo es.
    await expect(page.getByText("Hora de retiro")).toBeVisible();

    // Y la cocina lo ve marcado como programado, con su semáforo.
    await loginAsOwner(page);
    await page.goto("/admin/orders");
    await expect(page.getByText(/^Retiro \d.* · Programado$/).first()).toBeVisible();
  });

  /**
   * Fase 4 del checkout (D1) — el pedido puede ser para otro día.
   *
   * El recorrido entero: elegir el día, ver que "lo antes posible" desaparece (no se puede
   * pedir "ya" para mañana), confirmar y comprobar que la cocina lo recibe **separado del
   * turno de hoy** y con el día en la etiqueta.
   */
  test("un pedido para otro día no cae en el turno de hoy (D1)", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    await page.getByRole("button", { name: /^Retiro Lo antes posible · listo ~/ }).click();

    // Mañana, en la zona del negocio (el selector trabaja con el día del local).
    const tomorrow = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Managua",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));

    await page.getByLabel("Día de retiro").fill(tomorrow);

    await expect(page.getByRole("radio", { name: "Lo antes posible" })).toHaveCount(0);

    const slots = page.locator('input[name="pickupTimeOption"]');
    await expect(slots.first()).toBeVisible();
    await slots.first().click();

    // El control dice el día, no solo la hora.
    await expect(page.getByRole("button", { name: /^Retiro programado Mañana · \d/ })).toBeVisible();

    await page.locator('input[name="customerName"]').fill("Cliente Otro Dia");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await confirmButton(page).click();
    await expect(page).toHaveURL(/\/success\/.+/);

    // La confirmación del cliente también dice el día.
    await expect(page.getByText(/mañana \d/)).toBeVisible();

    // Y la bandeja del admin lo agrupa aparte del turno de hoy.
    await loginAsOwner(page);
    await page.goto("/admin/orders");
    await expect(page.getByText("Programados").first()).toBeVisible();

    const row = page
      .getByRole("link", { name: /Abrir orden/ })
      .filter({ hasText: "Cliente Otro Dia" })
      .first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("mañana");
  });

  test("el botón no arranca deshabilitado y señala el campo que falta", async ({ page }) => {    await openCheckoutWithOneProduct(page);

    // Un botón inerte que parece activo era el defecto: ahora se puede tocar siempre.
    await expect(confirmButton(page)).toBeEnabled();
    await confirmButton(page).click();

    await expect(page.getByText("Falta completar nombre.")).toHaveCount(1);
    await expect(page.locator('input[name="customerName"]')).toBeFocused();
  });

  test("el local que dejó de aceptar pedidos bloquea el checkout de verdad", async ({ page }) => {
    // Desde T8 el estado operativo es **del local**: cada sucursal tiene su interruptor, su
    // horario y su preparación. Antes era un solo interruptor para todo el negocio.
    async function setAcceptingOrders(value: "yes" | "no") {
      await page.goto("/admin/locations");
      await page.getByRole("button", { name: "Editar local Principal" }).click();
      await page.getByRole("combobox", { name: "Aceptando pedidos" }).selectOption(value);
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(page.getByText("Local actualizado.")).toBeVisible();
    }

    await openCheckoutWithOneProduct(page);
    await expect(confirmButton(page)).toBeEnabled();

    await loginAsOwner(page);

    try {
      await setAcceptingOrders("no");

      // El cartel de la home lee el mismo local (T8 fase 7): no puede decir "Abierto"
      // mientras el checkout rechaza el pedido. El punto distingue el cartel del texto de
      // abajo, que también dice "cerrados" (el mensaje del local).
      await page.goto("/");
      await expect(page.getByText("●Cerrado")).toBeVisible();

      await page.goto("/checkout");
      await expect(confirmButton(page)).toBeDisabled();
      await expect(page.getByRole("status")).toBeVisible();
      await expect(page.getByRole("button", { name: /^Lo antes posible/ })).toHaveCount(0);
    } finally {
      await setAcceptingOrders("yes");
    }

    // Y al reactivarlo, se puede volver a pedir.
    await page.goto("/checkout");
    await expect(confirmButton(page)).toBeEnabled();
  });

  test("creates a pickup order from checkout", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Taco de Birria" }),
    ).toBeVisible();

    await addSeedProductToCart(page);
    await page.goto("/checkout");

    await expect(page.getByRole("heading", { name: "Confirmá tu pedido" })).toBeVisible();
    await expect(page.getByText("Taco de Birria").first()).toBeVisible();
    await expect(page.getByText("Delivery")).toHaveCount(0);
    await expect(page.getByText("Mesa")).toHaveCount(0);

    // Payment and tip must be explicit before the customer confirms.
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toBeVisible();
    const tipToggle = page.getByRole("checkbox", { name: /Agregar propina del 10%/ });
    await expect(tipToggle).not.toBeChecked();
    await expect(page.getByText(/^Propina \(/)).toHaveCount(0);

    await page.locator('input[name="customerName"]').fill("Cliente E2E");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await confirmButton(page).click();

    await expect(page).toHaveURL(/\/success\/.+/);
    await expect(
      page.getByText(/Recibida|Confirmada|En preparación/).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Pagás en el local al retirar tu pedido.")).toBeVisible();
    await expect(page.getByText("No agregada")).toBeVisible();
  });

  test("keeps reservation entry points out of the MVP", async ({ page }) => {
    await page.goto("/reservations");
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByRole("heading", { name: "Menú" })).toBeVisible();
  });

  test("la forma de pago viaja con el pedido y se ve en la confirmación (T11)", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    // Se cobra en el local: el checkout pregunta cómo y arranca en efectivo.
    const cash = page.getByRole("radio", { name: "Efectivo" });
    const card = page.getByRole("radio", { name: "Tarjeta" });
    await expect(cash).toBeChecked();

    await card.check();
    await expect(card).toBeChecked();

    await page.locator('input[name="customerName"]').fill("Cliente Tarjeta");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await confirmButton(page).click();
    await expect(page).toHaveURL(/\/success\/.+/);

    // El cliente ve cómo va a pagar, y la caja también (lo mira el ticket del admin).
    await expect(page.getByText("Forma de pago")).toBeVisible();
    await expect(page.getByText("Tarjeta")).toBeVisible();
  });

  test("el vuelto del efectivo se calcula y se ve en la confirmación (T12)", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    // El monto solo se pregunta en efectivo (arranca en efectivo).
    const paidWith = page.getByLabel(/Con cuánto vas a pagar/);
    await expect(paidWith).toBeVisible();

    // El producto sembrado cuesta C$35; se paga con C$100.
    await paidWith.fill("100");
    await expect(page.getByText(/Cambio estimado: C\$65\.00/)).toBeVisible();

    await page.locator('input[name="customerName"]').fill("Cliente Vuelto");
    await page.locator('input[name="customerWhatsapp"]').fill("88887777");
    await confirmButton(page).click();
    await expect(page).toHaveURL(/\/success\/.+/);

    // El cliente ve con cuánto paga y cuánto le van a devolver.
    await expect(page.getByText("Pagás con")).toBeVisible();
    await expect(page.getByText("C$100.00")).toBeVisible();
    await expect(page.getByText("Cambio")).toBeVisible();
    await expect(page.getByText("C$65.00")).toBeVisible();
  });

  test("con tarjeta no se pregunta el vuelto (T12)", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    await page.getByRole("radio", { name: "Tarjeta" }).check();
    await expect(page.getByLabel(/Con cuánto vas a pagar/)).toHaveCount(0);
  });

  test("el campo del código avisa cuando el código no sirve (T9b)", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    // El descuento lo aplica el servidor; acá se comprueba que el campo existe y
    // que el rechazo se le muestra al cliente antes de confirmar.
    await page.getByLabel("Código de promo").fill("NOEXISTE");
    await page.getByRole("button", { name: "Aplicar" }).click();

    // El mensaje que devuelve el servidor, tal cual lo vería el cliente.
    await expect(page.getByText("No encontramos ese código.")).toBeVisible();
    await expect(page.getByRole("alert").first()).toBeVisible();
    // Y el pedido se puede confirmar igual: el código es opcional.
    await expect(confirmButton(page)).toBeEnabled();
  });
});

test.describe("checkout en celular", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

  test("muestra un solo CTA y un solo total", async ({ page }) => {
    await openCheckoutWithOneProduct(page);

    await expect(confirmButton(page)).toHaveCount(1);
    await expect(page.getByText("Total a pagar")).toHaveCount(1);
    // El importe viaja en la etiqueta del botón, no en una fila aparte.
    await expect(confirmButton(page)).toContainText("C$");
  });
});
