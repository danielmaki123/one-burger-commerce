import { chromium } from "playwright";
import path from "node:path";

/**
 * Capturas **reales de producción** de la venta en espera del POS (tareas 9.4/9.5).
 *
 * Se corre contra el panel de verdad (`admin.oneburgernic.com`) y contra la base de producción, así que
 * **no toca nada**: la venta en espera vive en el `localStorage` del navegador (no es un pedido y no hay
 * petición que la cree), se guarda, se captura, se descarta con su confirmación y se limpia.
 *
 * El script corre en dos anchos (1280 y 375) y guarda en `ops/tasks/audit-ui/`.
 *
 *   node scripts/capture-pos-produccion.mjs https://admin.oneburgernic.com
 *
 * Las credenciales van por entorno (`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`): son de una cuenta de QA, no
 * se escriben en el repo.
 */

const baseUrl = process.argv[2] ?? "https://admin.oneburgernic.com";
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const repoRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(repoRoot, "ops", "tasks", "audit-ui");

if (!email || !password) {
  throw new Error("faltan E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD en el entorno");
}

async function shot(page, name, viewport) {
  const file = path.join(outputRoot, `${name}-${viewport}.png`);
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
    await page.waitForSelector('[aria-label="Venta en curso"]', { timeout: 60_000 });

    // Una terminal limpia: ni borrador ni esperas de una corrida anterior.
    await page.evaluate(() => {
      const store = globalThis.localStorage;
      for (const key of Object.keys(store)) {
        if (key.startsWith("one-burger-pos-")) store.removeItem(key);
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Venta en curso"]', { timeout: 60_000 });

    const agregar = page.getByRole("button", { name: /^Agregar .+ a la venta$/ }).first();
    await agregar.waitFor({ timeout: 60_000 });
    await agregar.click();
    await page.getByLabel("Nombre del cliente").fill("Espera captura");
    await page.getByRole("button", { name: "Guardar en espera" }).click();

    const panelEspera = page.getByRole("region", { name: "Ventas en espera" });
    await panelEspera.waitFor({ timeout: 30_000 });
    await panelEspera.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, "tarea-9-4-venta-en-espera-produccion", viewport.name);

    await page.getByRole("button", { name: "Descartar la venta de Espera captura" }).click();
    await page.getByRole("dialog").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(400);
    await shot(page, "tarea-9-5-descartar-confirmacion-produccion", viewport.name);
    await page.getByRole("button", { name: "Sí, descartar" }).click();
    await page.getByText("No hay ventas en espera.").waitFor({ timeout: 30_000 });

    /**
     * Tarea 9.6 — el cupón. Se crea una promo real (10 %) desde la propia página, se aplica en el mostrador
     * —el servidor la cotiza y el total baja— y **se borra** al final: la base de producción queda igual.
     */
    const promoCode = `CAPTURA${Date.now().toString(36).toUpperCase()}`;
    const promo = await page.evaluate(async (code) => {
      const response = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, type: "percentage", value: 10, isActive: true, usageLimit: 0 }),
      });
      const body = await response.json();

      return { ok: response.ok, id: body.data?.id ?? null };
    }, promoCode);
    if (!promo.ok) throw new Error("no se pudo crear la promo de la captura");

    await page.getByRole("button", { name: /^Agregar / }).first().click();
    await page.getByLabel("Nombre del cliente").fill("Cliente captura");
    await page.getByLabel("Código de promo (opcional)").fill(promoCode);
    await page.getByRole("button", { name: "Aplicar", exact: true }).click();
    await page.getByText("10 % de descuento").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Cobrar / }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, "tarea-9-6-promo-aplicada-produccion", viewport.name);

    await page.getByRole("button", { name: "Quitar", exact: true }).click();
    if (promo.id) {
      await page.evaluate(async (id) => {
        await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      }, promo.id);
    }

    // Tarea 9.7 — el descuento manual, que en producción lo ve el dueño (la cuenta de QA es admin).
    await page.getByLabel("Descuento (%)").fill("10");
    await page.getByLabel("Motivo del descuento").fill("Cliente de siempre");
    await page.getByRole("button", { name: "Aplicar descuento" }).click();
    await page.getByText("Descuento manual · 10 %").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Cobrar / }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, "tarea-9-7-descuento-manual-produccion", viewport.name);

    // La venta queda limpia: la captura no deja nada a medio armar en el mostrador.
    await page.getByRole("button", { name: "Quitar descuento" }).click();
    await page.getByRole("button", { name: /^Sacar / }).first().click();

    await context.close();
  }
} finally {
  await browser.close();
}
