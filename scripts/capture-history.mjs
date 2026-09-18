import { chromium } from "playwright";
import path from "node:path";

/**
 * Capturas del **Historial** (Punto 2 del roadmap, 2026-09-18): las dos tabs de la sección, el ítem
 * único del sidebar y el modal de anulación del dueño. Corre contra el server local con la base de
 * demo, así que no toca producción:
 *
 *   node scripts/capture-history.mjs http://127.0.0.1:3210
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

    // El ítem del sidebar es uno solo y queda activo en las dos tabs.
    await page.goto(`${baseUrl}/admin/history/cierres`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("history-readonly-badge").waitFor({ timeout: 60_000 });
    await page.getByRole("link", { name: "Facturas", exact: true }).first().waitFor({ timeout: 60_000 });

    // Sin filtro de día: la base de demo puede no tener cierres justo hoy.
    await page.getByLabel("Día del cierre").fill("");
    await page.waitForTimeout(1_200);
    await shot(page, "tarea-historial-cierres", viewport.name);

    await page.getByRole("link", { name: "Facturas", exact: true }).first().click();
    await page.waitForURL(/\/admin\/history\/facturas/, { timeout: 30_000 });
    await page.getByTestId("history-readonly-badge").waitFor({ timeout: 60_000 });
    await page.getByLabel("Día de la factura").fill("");
    await page.waitForTimeout(1_200);
    await shot(page, "tarea-historial-facturas", viewport.name);

    // El modal de anulación solo tiene que existir para el dueño y con una factura emitida a la vista.
    const anunciar = page.getByRole("button", { name: "Anular" }).first();
    if (await anunciar.count()) {
      await anunciar.click();
      await page.getByRole("dialog").waitFor({ timeout: 15_000 });
      await page.waitForTimeout(400);
      await shot(page, "tarea-historial-anular", viewport.name);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
