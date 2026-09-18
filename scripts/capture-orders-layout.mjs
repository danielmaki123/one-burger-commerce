import { chromium } from "playwright";
import path from "node:path";

/**
 * Capturas locales de la pantalla de Órdenes con el **layout unificado** (Punto 1 del roadmap,
 * 2026-09-18): la barra lateral del panel y el encabezado "Órdenes" están en las dos vistas —carriles
 * y lista de cerradas— y el sub-filtro Hoy/Historial ya no existe.
 *
 * Corre contra el server local (`PORT=3210`) con la base de demo, así que no toca producción:
 *
 *   node scripts/capture-orders-layout.mjs http://127.0.0.1:3210
 */

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3210";
const email = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.E2E_ADMIN_PASSWORD ?? "Admin1234!";
const repoRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(repoRoot, "ops", "tasks", "audit-ui");
/** Contra producción el nombre lo dice: la captura local y la real no se pisan. */
const sufijo = /127\.0\.0\.1|localhost/.test(baseUrl) ? "" : "-produccion";

async function shot(page, name, viewport) {
  const file = path.join(outputRoot, `${name}${sufijo}-${viewport}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`captura: ${path.relative(repoRoot, file)}`);
}

/**
 * El shell del panel: la barra lateral tiene que estar a la vista en las dos vistas. En celular la
 * navegación es la barra inferior del panel, así que se acepta cualquiera de las dos.
 */
async function assertShellVisible(page, vista) {
  const candidatos = page.locator("aside, nav");
  const total = await candidatos.count();
  let visible = false;

  for (let i = 0; i < total; i += 1) {
    if (await candidatos.nth(i).isVisible()) visible = true;
  }

  if (!visible) {
    throw new Error(`la barra lateral no está visible en ${vista}`);
  }

  const header = page.getByRole("heading", { name: "Órdenes" });
  if (!(await header.isVisible())) {
    throw new Error(`el encabezado Órdenes no está visible en ${vista}`);
  }
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

    await page.goto(`${baseUrl}/admin/orders`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("comandas-topbar").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(600);

    await assertShellVisible(page, "carriles");
    await shot(page, "tarea-layout-ordenes-carriles", viewport.name);

    // El mismo shell, con las cerradas como lista y sin el sub-filtro Hoy/Historial.
    await page.getByRole("button", { name: "Cerradas" }).click();
    await page.waitForTimeout(900);

    await assertShellVisible(page, "cerradas");
    await shot(page, "tarea-layout-ordenes-cerradas", viewport.name);

    // Y queda como evidencia de que el sub-filtro se fue.
    const viejo = await page.getByRole("button", { name: "Historial" }).count();
    if (viejo > 0) {
      throw new Error(`el sub-filtro Historial sigue en la pantalla (${viewport.name})`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
