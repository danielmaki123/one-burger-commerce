/**
 * Capturas de verificación del roadmap del POS (Fase 2).
 *
 * Herramienta de verificación, no producto: abre el panel en un navegador real a 375 px y 1280 px con
 * la sesión del owner del seed local y guarda las capturas en `ops/tasks/audit-ui/`, que es donde el
 * owner las revisa. No está en `test-results/` a propósito: Playwright limpia ese directorio al
 * arrancar y se llevaba el script.
 *
 * Uso (con el server local levantado):
 *   node scripts/capture-pos-blocks.mjs http://127.0.0.1:3210
 */
/* global document */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3210";
const repoRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(repoRoot, "ops", "tasks", "audit-ui");

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 900 },
];

mkdirSync(outputRoot, { recursive: true });

const browser = await chromium.launch();

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill("admin@example.com");
    await page.locator('input[type="password"]').fill("Admin1234!");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL(/\/admin(?:\/orders)?$/, { timeout: 60_000 });

    // Bloque 8: la barra lateral con los cuatro grupos y el Control.
    await page.goto(`${baseUrl}/admin/cash`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Cierres de caja"], [aria-label="Qué turnos mostrar"]', {
      state: "attached",
      timeout: 30_000,
    });
    await page.waitForTimeout(600);
    await shot(page, "bloque-8-caja-del-dia", viewport.name);

    // Tarea 1.5 del roadmap (2026-09-17): el reporte diario de caja, con su selector de día.
    await page.goto(`${baseUrl}/admin/cash/report`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Reporte de caja del día"]', { timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "tarea-1-5-reporte-del-dia", viewport.name);

    // Bloque 11.5/11.6: el cierre del día consolidado (todas las sucursales del alcance) y la
    // comparación por sucursal, arriba del historial.
    await page.evaluate(() => {
      document.querySelector('[aria-label="Cierre del día"]')?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(400);
    await shot(page, "bloque-11-cierre-del-dia", viewport.name);

    // Bloque 1.4: el detalle de un cierre (el server component que fallaba en runtime).
    const shiftId = await firstShiftId(page);
    if (!shiftId) throw new Error("no hay turnos en la base local para el detalle");

    await page.goto(`${baseUrl}/admin/cash/history/${shiftId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Arqueo del cierre"]', { timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "bloque-1-cierre-detalle", viewport.name);

    // Tarea 1.2 del roadmap (2026-09-17): el desglose por medio del turno, congelado al cerrar.
    await page.evaluate(() => {
      document.querySelector('[aria-label="Cobros por medio"]')?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
    await shot(page, "tarea-1-2-cobros-por-medio", viewport.name);

    // Bloque 13.3: el botón que imprime la hoja de cierre y **la hoja** (el papel que se firma, con el
    // nombre de quien cerró). Se captura la ventana de impresión tal como sale, sin retocar nada.
    const closedShiftId = await firstClosedShiftId(page);
    if (closedShiftId) {
      await page.goto(`${baseUrl}/admin/cash/history/${closedShiftId}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector('[aria-label="Arqueo del cierre"]', { timeout: 30_000 });
      await page.waitForTimeout(400);
      await shot(page, "bloque-13-boton-imprimir-cierre", viewport.name);

      const [hoja] = await Promise.all([
        page.waitForEvent("popup"),
        page.getByRole("button", { name: "Imprimir cierre" }).click(),
      ]);
      await hoja.waitForLoadState("domcontentloaded");
      await hoja.setViewportSize({ width: 420, height: 900 });
      await hoja.waitForTimeout(400);
      await shot(hoja, "bloque-13-hoja-cierre-impresa", viewport.name);
      await hoja.close();
    }

    // Bloque 2: los movimientos del turno, con su alta.
    await page.evaluate(() => {
      document
        .querySelector('[aria-label="Movimientos de caja"]')
        ?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
    await shot(page, "bloque-2-movimientos", viewport.name);

    // Bloque 3: la bandeja de aprobaciones (la cola de devoluciones pendientes).
    await page.goto(`${baseUrl}/admin/approvals`, { waitUntil: "domcontentloaded" });
    // La pantalla muestra la lista o el estado vacío; alcanza con esperar el encabezado.
    await page.waitForSelector("h1", { state: "attached", timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "bloque-3-aprobaciones", viewport.name);

    // Decisión del owner (2026-09-17): la sección de alertas rediseñada —estado, configuración, eventos
    // con interruptores e historial— y su entrada nueva en el sidebar. La captura del encabezado muestra
    // las dos cosas: el panel y el grupo CONFIGURACIÓN con «Alertas».
    await page.goto(`${baseUrl}/admin/settings/notifications`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Estado de las alertas"]', { timeout: 30_000 });
    // El sidebar resuelve el rol en el cliente: hasta que llega la sesión dibuja el nav mínimo. Se espera
    // a que esté el enlace del owner para que la captura muestre «Alertas» dentro de CONFIGURACIÓN.
    await page.waitForSelector('aside[data-admin-background] a[href="/admin/settings"]', {
      // A 375 px el sidebar de escritorio está `hidden`: alcanza con que el enlace exista en el DOM.
      state: "attached",
      timeout: 30_000,
    });
    // Con el nav del owner ya dibujado, se baja el scroll del sidebar para que «Alertas» (la última
    // entrada de CONFIGURACIÓN) entre en la captura: en 900 px de alto queda justo debajo del pliegue.
    await page.evaluate(() => {
      const nav = document.querySelector("aside[data-admin-background] nav");
      if (nav) nav.scrollTop = nav.scrollHeight;
    });
    await page.waitForTimeout(600);
    await page.waitForTimeout(800);
    await shot(page, "alertas-telegram", viewport.name);

    await page.evaluate(() => {
      document
        .querySelector('[aria-label="Eventos que se avisan"]')
        ?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(400);
    await shot(page, "alertas-telegram-eventos", viewport.name);

    await page.evaluate(() => {
      document.querySelector('[aria-label="Historial de envíos"]')?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
    await shot(page, "alertas-telegram-historial", viewport.name);

    // Bloque 9.2: el POS diciendo que hay que abrir la caja.
    await page.goto(`${baseUrl}/admin/pos`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Venta en curso"]', { timeout: 30_000 });
    await page.waitForTimeout(900);
    await shot(page, "bloque-9-pos-caja", viewport.name);

    // Tareas 9.4/9.5 del roadmap (2026-09-17): la venta **en espera**. Se arma una venta, se deja a un
    // lado y se captura la lista con lo que llevaba (de quién es, cuántas unidades, el total y desde
    // cuándo). Después se descarta con su confirmación —lo único que no se deshace— y se limpia, para
    // que las capturas que vienen muestren el mostrador como lo encuentra el cajero.
    await page.evaluate(() => {
      const store = globalThis.localStorage;
      for (const key of Object.keys(store)) {
        if (key.startsWith("one-burger-pos-holds")) store.removeItem(key);
      }
    });
    await page.getByRole("button", { name: /^Agregar / }).first().click();
    await page.getByLabel("Nombre del cliente").fill("Espera captura");
    await page.getByRole("button", { name: "Guardar en espera" }).click();
    const panelEspera = page.getByRole("region", { name: "Ventas en espera" });
    await panelEspera.waitFor({ timeout: 30_000 });
    await panelEspera.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, "tarea-9-4-venta-en-espera", viewport.name);

    await page.getByRole("button", { name: "Descartar la venta de Espera captura" }).click();
    await page.getByRole("dialog").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(400);
    await shot(page, "tarea-9-5-descartar-confirmacion", viewport.name);
    await page.getByRole("button", { name: "Sí, descartar" }).click();
    await page.getByText("No hay ventas en espera.").waitFor({ timeout: 30_000 });

    // Tarea 9.6 del roadmap (2026-09-17): el **cupón** que trajo el cliente. Se crea una promo real por la
    // API del admin (10 %), se aplica en el mostrador —el servidor cotiza el descuento y el total baja—, se
    // captura y se borra: la base local queda como estaba.
    const promoCode = `CAPTURA${Date.now().toString(36).toUpperCase()}`;
    await page.evaluate(async (code) => {
      await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, type: "percentage", value: 10, isActive: true, usageLimit: 0 }),
      });
    }, promoCode);

    await page.getByRole("button", { name: /^Agregar / }).first().click();
    await page.getByLabel("Nombre del cliente").fill("Cliente captura");
    await page.getByLabel("Código de promo (opcional)").fill(promoCode);
    await page.getByRole("button", { name: "Aplicar" }).click();
    await page.getByText("10 % de descuento").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Cobrar / }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, "tarea-9-6-promo-aplicada", viewport.name);

    await page.getByRole("button", { name: "Quitar", exact: true }).click();
    await page.getByRole("button", { name: /^Sacar / }).first().click();
    await page.evaluate(async (code) => {
      const list = await (await fetch("/api/admin/promotions")).json();
      const promo = list.data.find((item) => item.code === code);
      if (promo) await fetch(`/api/admin/promotions/${promo.id}`, { method: "DELETE" });
    }, promoCode);

    // El aviso y el botón bloqueado viven al final del formulario de cobro: se baja hasta ahí para
    // que la captura muestre **el efecto** del bloqueo, no solo el estado de la caja.
    await page.evaluate(() => {
      const cobrar = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.trim().startsWith("Cobrar"),
      );
      cobrar?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
    await shot(page, "bloque-9-cobro-bloqueado", viewport.name);

    // Bloque 10.1/10.2: los dos papeles de una venta de mostrador. Se cobra una venta de verdad
    // (contra la base local) para que la confirmación muestre los dos botones, y se captura el ticket
    // del cliente tal como sale impreso.
    await ensureOpenShift(page);

    // Bloque 12.3/12.4: la venta en curso se recupera después de una recarga y, sin red, el cobro se
    // bloquea con el motivo escrito (un cobro que no se registra es un pedido perdido).
    await page.getByRole("button", { name: /^Agregar / }).first().click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Venta en curso"]', { timeout: 30_000 });
    await page.getByRole("button", { name: /^Cobrar / }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "bloque-12-venta-recuperada", viewport.name);

    await context.setOffline(true);
    await page.waitForTimeout(600);
    await shot(page, "bloque-12-sin-conexion", viewport.name);
    await context.setOffline(false);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /^Agregar / }).first().click();
    // Se paga el doble del total mostrado (mismo camino que el E2E del POS) para que la confirmación
    // muestre el cambio, que es parte del ticket del cliente.
    const etiquetaCobrar = await page.getByRole("button", { name: /^Cobrar / }).textContent();
    const totalVenta = Number((etiquetaCobrar ?? "").replace(/[^\d.]/g, ""));
    await page.getByLabel("Nombre del cliente").fill("Cliente captura");
    await page.getByLabel("Número del cliente").fill("88887777");
    await page.getByLabel("Con cuánto paga").fill(String(totalVenta * 2));
    await page.getByRole("button", { name: /^Cobrar / }).click();
    // La confirmación del cobro (no cualquier `role=status` de la pantalla) vive al final del
    // formulario: se espera y se baja hasta ahí para que la captura muestre los dos botones.
    const confirmacionVenta = page.getByRole("status").filter({ hasText: /Venta P-/ });
    await confirmacionVenta.waitFor({ timeout: 30_000 });
    await confirmacionVenta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, "bloque-10-botones-ticket", viewport.name);

    const [ticketCliente] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Ticket de cliente" }).click(),
    ]);
    await ticketCliente.waitForLoadState("domcontentloaded");
    await ticketCliente.setViewportSize({ width: 420, height: 820 });
    await ticketCliente.waitForTimeout(400);
    await shot(ticketCliente, "bloque-10-ticket-cliente", viewport.name);
    await ticketCliente.close();

    // Tarea 7 del brief (2026-09-17): el **corte X** y el **traspaso de caja** (1.12 y 1.13). El panel
    // vive en Caja del día con la caja abierta; el papel del traspaso se captura tal como sale impreso.
    await page.goto(`${baseUrl}/admin/cash`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Corte y traspaso de caja"]', { timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "tarea-7-corte-y-traspaso", viewport.name);

    const [corteX] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Imprimir corte X" }).click(),
    ]);
    await corteX.waitForLoadState("domcontentloaded");
    await corteX.setViewportSize({ width: 420, height: 760 });
    await corteX.waitForTimeout(400);
    await shot(corteX, "tarea-7-corte-x-impreso", viewport.name);
    await corteX.close();

    await page.getByLabel("Recibe la caja").fill("Carlos Ruiz");
    const [traspaso] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("button", { name: "Firmar traspaso" }).click(),
    ]);
    await traspaso.waitForLoadState("domcontentloaded");
    await traspaso.setViewportSize({ width: 420, height: 760 });
    await traspaso.waitForTimeout(400);
    await shot(traspaso, "tarea-7-traspaso-impreso", viewport.name);
    await traspaso.close();

    await page.waitForTimeout(400);
    await shot(page, "tarea-7-traspaso-registrado", viewport.name);

    // Tarea 10 del brief (2026-09-17): la **conciliación** de tarjeta y transferencia (11.1/11.2).
    await page.evaluate(() => {
      document
        .querySelector('[aria-label="Conciliación de tarjeta y transferencia"]')
        ?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(600);
    await shot(page, "tarea-10-conciliacion", viewport.name);

    await context.close();
  }

  async function firstShiftId(target) {
    return target.evaluate(async () => {
      const locationsResponse = await fetch("/api/admin/locations", { cache: "no-store" });
      const locations = (await locationsResponse.json()).data ?? [];

      for (const location of locations) {
        const shiftsResponse = await fetch(
          `/api/admin/cash/shifts?locationId=${encodeURIComponent(location.id)}`,
          { cache: "no-store" },
        );
        const shifts = (await shiftsResponse.json()).data ?? [];
        if (shifts.length) return shifts[0].id;
      }

      return null;
    });
  }

  /** Un turno cerrado con arqueo: es el único que tiene hoja de cierre para firmar (Bloque 13.3). */
  async function firstClosedShiftId(target) {
    return target.evaluate(async () => {
      const locationsResponse = await fetch("/api/admin/locations", { cache: "no-store" });
      const locations = (await locationsResponse.json()).data ?? [];

      for (const location of locations) {
        const shiftsResponse = await fetch(
          `/api/admin/cash/shifts?locationId=${encodeURIComponent(location.id)}`,
          { cache: "no-store" },
        );
        const shifts = (await shiftsResponse.json()).data ?? [];
        const closed = shifts.find(
          (shift) => shift.status === "closed" && shift.closingAmount !== null,
        );
        if (closed) return closed.id;
      }

      return null;
    });
  }

  /**
   * Deja una caja abierta en el primer local con mostrador: cobrar una venta lo exige (Bloque 9.2), y
   * la captura del ticket de cliente necesita una venta cobrada de verdad.
   */
  async function ensureOpenShift(target) {
    await target.evaluate(async () => {
      const locations = ((await (await fetch("/api/admin/locations")).json()).data ?? []).filter(
        (location) => location.posEnabled,
      );

      for (const location of locations) {
        const open = (
          await (
            await fetch(`/api/admin/pos/shift?locationId=${encodeURIComponent(location.id)}`, {
              cache: "no-store",
            })
          ).json()
        ).data;

        if (open) return;

        const created = await fetch("/api/admin/pos/shift/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId: location.id, counts: [] }),
        });

        if (created.ok) return;
      }
    });

    await target.reload({ waitUntil: "domcontentloaded" });
    await target.waitForSelector('[aria-label="Venta en curso"]', { timeout: 30_000 });
  }

  async function shot(target, file, viewportName) {
    const full = path.join(outputRoot, `${file}-${viewportName}.png`);
    await target.screenshot({ path: full, fullPage: false });
    console.log(`captura: ${path.relative(repoRoot, full)}`);
  }

  /**
   * El sidebar completo: a 900 px de alto la última entrada de CONFIGURACIÓN («Alertas») queda por debajo
   * del pliegue y no entra en la captura. Se toma aparte, más alto, para poder mostrar la entrada nueva.
   */
  async function capturarSidebarCompleto() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
    const target = await context.newPage();

    await target.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
    await target.locator('input[type="email"]').fill("admin@example.com");
    await target.locator('input[type="password"]').fill("Admin1234!");
    await target.getByRole("button", { name: "Iniciar sesión" }).click();
    await target.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 60_000 });

    await target.goto(`${baseUrl}/admin/settings/notifications`, { waitUntil: "domcontentloaded" });
    await target.waitForSelector('aside[data-admin-background] a[href="/admin/settings/notifications"]', {
      state: "visible",
      timeout: 30_000,
    });
    await target.waitForTimeout(600);
    await shot(target, "sidebar-alertas", "1280");
    await context.close();
  }

  await capturarSidebarCompleto();
} finally {
  await browser.close();
}
