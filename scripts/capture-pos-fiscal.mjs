import { chromium } from "playwright";
import path from "node:path";

/**
 * Capturas del **checkbox fiscal del POS** (Punto 4 del roadmap, 2026-09-18).
 *
 * Lo que el owner pidió ver: el tilde «Cliente pide factura con RUC» después del correo, y —con el tilde
 * puesto— los campos RUC y razón social. Se captura a 1280 y 375 px.
 *
 * Corre contra el server local (`PORT=3210`) con la base de demo:
 *
 *   node scripts/capture-pos-fiscal.mjs http://127.0.0.1:3210
 */

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3210";
const email = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.E2E_ADMIN_PASSWORD ?? "Admin1234!";
const repoRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(repoRoot, "ops", "tasks", "audit-ui");
const sufijo = /127\.0\.0\.1|localhost/.test(baseUrl) ? "" : "-produccion";

async function shot(page, name, viewport) {
  const file = path.join(outputRoot, `${name}${sufijo}-${viewport}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`captura: ${path.relative(repoRoot, file)}`);
}

const browser = await chromium.launch();

try {
  for (const viewport of [
    { name: "1280", width: 1280, height: 900 },
    { name: "375", width: 375, height: 812 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/admin/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL(/\/admin(?:\/orders)?$/, { timeout: 90_000 });

    await page.goto(`${baseUrl}/admin/pos`, { waitUntil: "domcontentloaded" });
    const toggle = page.getByLabel("Cliente pide factura con RUC");
    await toggle.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(600);

    // 1. Sin factura: el tilde está apagado y no hay campos fiscales.
    if (await page.getByLabel("RUC (mínimo 8 caracteres)").count()) {
      throw new Error(`los campos fiscales aparecen sin el tilde (${viewport.name})`);
    }
    await shot(page, "tarea-punto4-pos-factura-apagada", viewport.name);

    // 2. Con el tilde puesto: RUC y razón social.
    await toggle.check();
    await page.getByLabel("RUC (mínimo 8 caracteres)").waitFor({ timeout: 30_000 });
    await page.getByLabel("Nombre del cliente").fill("Distribuidora La Unión");
    await page.getByLabel("Número del cliente").fill("88887777");
    await page.getByLabel("RUC (mínimo 8 caracteres)").fill("J0310000001");
    await page.getByLabel("Razón social").fill("Distribuidora La Unión");
    await page.waitForTimeout(400);
    await shot(page, "tarea-punto4-pos-factura-prendida", viewport.name);

    await context.close();
  }
} finally {
  await browser.close();
}
