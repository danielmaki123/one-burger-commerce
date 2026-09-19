/**
 * Capturas de las mejoras visuales del POS (rama `feature/pos-ui-mejoras`, 2026-09-19).
 *
 * Herramienta de verificación, no producto: abre el panel en un navegador real a 375 px y 1280 px con la
 * sesión del owner del seed local y guarda las capturas en `ops/tasks/audit-ui/`, que es donde el owner
 * las revisa.
 *
 * El **mismo** script corre sobre `main` (antes) y sobre la rama (después): cada paso se saltea si la
 * pieza todavía no existe en esa versión, así el antes/después sale del mismo recorrido y no de dos
 * scripts distintos.
 *
 * Uso (con el server local levantado):
 *   node scripts/capture-pos-ui.mjs antes http://127.0.0.1:3210
 *   node scripts/capture-pos-ui.mjs despues http://127.0.0.1:3210
 */
/* global document, window */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const label = process.argv[2] ?? "despues";
const baseUrl = process.argv[3] ?? "http://127.0.0.1:3210";
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
    await page.waitForURL((url) => !url.pathname.includes("/admin/login"), { timeout: 60_000 });

    await page.goto(`${baseUrl}/admin/pos`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Productos del local"]', { timeout: 30_000 });
    await page.waitForTimeout(900);

    // 1) El catálogo: fotos, chips de categoría con su contador y las tarjetas.
    await shot(page, `pos-ui-catalogo-${label}`, viewport.name);

    // 1b) El producto agotado (visible y sin botón), que a 375 px cae debajo del pliegue.
    const agotado = await page.evaluate(() => {
      const lista = document.querySelector('[aria-label="Productos del local"]');
      const card = Array.from(lista?.children ?? []).find((item) =>
        item.textContent?.includes("Agotado"),
      );
      if (!card) return false;
      card.scrollIntoView({ block: "center" });
      return true;
    });
    if (agotado) {
      await page.waitForTimeout(400);
      await shot(page, `pos-ui-agotado-${label}`, viewport.name);
      await page.evaluate(() => window.scrollTo({ top: 0 }));
    }

    // 2) Los chips filtrando: se elige la segunda categoría y se vuelve a «Todos».
    const chips = page.getByRole("group", { name: "Categorías del catálogo" });
    if ((await chips.count()) > 0) {
      const segunda = chips.getByRole("button").nth(1);
      await segunda.click();
      await page.waitForTimeout(400);
      await shot(page, `pos-ui-catalogo-filtrado-${label}`, viewport.name);
      await segunda.click();
      await page.waitForTimeout(300);
    }

    // 3) La venta: un producto sin modificadores directo y uno con modificadores por el selector.
    const agregar = page.getByRole("button", { name: /^Agregar .* a la venta$/ });
    if ((await agregar.count()) > 0) {
      await agregar.first().click();
      await page.waitForTimeout(400);
    }

    // 3b) El selector de modificadores: solo existe en la rama (en `main` la tarjeta no tiene botón).
    const conModificadores = page.getByRole("button", {
      name: /^Agregar Taco de Pastor a la venta$/,
    });
    if ((await conModificadores.count()) > 0) {
      await conModificadores.first().click();
      const dialogo = page.getByRole("dialog");
      if (await dialogo.isVisible().catch(() => false)) {
        await page.waitForTimeout(500);
        await shot(page, `pos-ui-modal-${label}`, viewport.name);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    // 4) El cobro: campos del cliente con íconos, montos rápidos, vuelto en vivo y el aviso de caja.
    await page.getByLabel("Nombre del cliente").fill("Cliente captura");
    await page.getByLabel("Número del cliente").fill("88887777");

    const cuánto = page.getByLabel("Con cuánto paga");
    await cuánto.fill("1000");
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      document.querySelector('[aria-label="Venta en curso"]')?.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(400);
    await shot(page, `pos-ui-cobro-${label}`, viewport.name);

    // 5) El aviso de caja cerrada, con el formulario y el botón a la vista (sin turno abierto).
    await page.evaluate(() => {
      const cobrar = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent?.trim().startsWith("Cobrar"),
      );
      cobrar?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(400);
    await shot(page, `pos-ui-caja-${label}`, viewport.name);

    await context.close();
  }
} finally {
  await browser.close();
}

async function shot(target, file, viewportName) {
  const full = path.join(outputRoot, `${file}-${viewportName}.png`);
  await target.screenshot({ path: full, fullPage: false });
  console.log(`captura: ${path.relative(repoRoot, full)}`);
}
