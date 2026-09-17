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

    // Bloque 1.4: el detalle de un cierre (el server component que fallaba en runtime).
    const shiftId = await firstShiftId(page);
    if (!shiftId) throw new Error("no hay turnos en la base local para el detalle");

    await page.goto(`${baseUrl}/admin/cash/history/${shiftId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Arqueo del cierre"]', { timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "bloque-1-cierre-detalle", viewport.name);

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

    // Bloque 9.2: el POS diciendo que hay que abrir la caja.
    await page.goto(`${baseUrl}/admin/pos`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Venta en curso"]', { timeout: 30_000 });
    await page.waitForTimeout(900);
    await shot(page, "bloque-9-pos-caja", viewport.name);

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

  async function shot(target, file, viewportName) {
    const full = path.join(outputRoot, `${file}-${viewportName}.png`);
    await target.screenshot({ path: full, fullPage: false });
    console.log(`captura: ${path.relative(repoRoot, full)}`);
  }
} finally {
  await browser.close();
}
