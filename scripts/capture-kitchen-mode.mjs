import { chromium } from "playwright";
import path from "node:path";

/**
 * Capturas locales del **modo cocina** (Punto 3 del roadmap, 2026-09-18).
 *
 * Lo que el owner pidió ver: la barra de trabajo con el botón «Modo cocina», y el modo prendido —sin
 * barra lateral ni encabezado, solo los carriles— con su botón «Salir» arriba a la derecha y sus
 * cinco tabs. Se captura a 1280 y 375 px, y se falla si el chrome no se esconde: la captura no puede
 * pasar por buena si el modo no hizo nada.
 *
 * Corre contra el server local (`PORT=3210`) con la base de demo:
 *
 *   node scripts/capture-kitchen-mode.mjs http://127.0.0.1:3210
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

    // 1. La barra de trabajo del panel, con el botón que prende el modo.
    await page.goto(`${baseUrl}/admin/orders`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("comandas-topbar").waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Modo cocina" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    await shot(page, "tarea-punto3-modo-cocina-apagado", viewport.name);

    // 2. El modo prendido: solo los carriles, la barra de la cocina y «Salir».
    await page.getByRole("button", { name: "Modo cocina" }).click();
    await page.getByRole("button", { name: "Salir" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);

    const sidebar = page.locator(".admin-sidebar-shell");
    if (await sidebar.isVisible()) {
      throw new Error(`la barra lateral sigue visible en modo cocina (${viewport.name})`);
    }
    const header = page.getByRole("heading", { name: "Órdenes", exact: true });
    if (await header.count()) {
      throw new Error(`el encabezado Órdenes sigue en el DOM en modo cocina (${viewport.name})`);
    }
    await shot(page, "tarea-punto3-modo-cocina-prendido", viewport.name);

    // 3. El tab de despachadas: la pregunta que el tablero no tiene.
    await page.getByTestId("kitchen-tab-dispatched").click();
    await page.waitForTimeout(600);
    await shot(page, "tarea-punto3-modo-cocina-despachadas", viewport.name);

    // La preferencia es del dispositivo: se comprueba y se apaga para no dejar la tablet encendida.
    // (`globalThis` y no `window`: los callbacks de `page.evaluate` corren en el navegador, pero el
    // linter los lee como Node.)
    const guardado = await page.evaluate(() =>
      globalThis.localStorage.getItem("one-burger:comanda-view"),
    );
    if (guardado !== "1") {
      throw new Error(`el modo cocina no quedó guardado en el dispositivo (${viewport.name})`);
    }

    await page.getByRole("button", { name: "Salir" }).click();
    await page.getByTestId("comandas-topbar").waitFor({ timeout: 30_000 });
    const apagado = await page.evaluate(() =>
      globalThis.localStorage.getItem("one-burger:comanda-view"),
    );
    if (apagado !== null) {
      throw new Error(`el modo cocina no se apagó al salir (${viewport.name})`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
