/**
 * Capturas y JSON del catálogo del POS (rama `feature/pos-catalogo-modificadores`, 2026-09-19).
 *
 * Herramienta de verificación, no producto: abre el panel en un navegador real a 375 px y 1280 px con la
 * sesión del owner del seed local, guarda las capturas en `ops/tasks/audit-ui/` (donde el owner las
 * revisa) y **además** baja el JSON del menú público y el del catálogo del mostrador para poder comparar
 * el contrato antes/después del cambio de caso de uso.
 *
 * Uso (con el server local levantado):
 *   node scripts/capture-pos-catalogo.mjs <etiqueta> [baseUrl]
 *   node scripts/capture-pos-catalogo.mjs antes http://127.0.0.1:3210
 */
/* global document */
import { mkdirSync, writeFileSync } from "node:fs";
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

    // 1) El menú público tal cual lo ve un cliente: es el contrato que este cambio NO puede tocar.
    const menu = await page.evaluate(async () =>
      (await fetch("/api/menu", { cache: "no-store" })).json(),
    );
    save(`pos-catalogo-menu-${label}.json`, JSON.stringify(menu, null, 2));

    // 2) El catálogo del mostrador: la vista del POS, con los agotados y los chips de categoría.
    const catalog = await page.evaluate(async () => {
      const locations =
        ((await (await fetch("/api/admin/locations", { cache: "no-store" })).json()).data ?? []).filter(
          (location) => location.posEnabled,
        );
      const location = locations[0];
      if (!location) return null;

      const view = await (
        await fetch(`/api/admin/pos/catalog?locationId=${encodeURIComponent(location.id)}`, {
          cache: "no-store",
        })
      ).json();

      return { locationId: location.id, locationName: location.name, view: view.data };
    });
    save(`pos-catalogo-vista-${label}.json`, JSON.stringify(catalog, null, 2));

    // 3) La pantalla del mostrador, que es lo que el cajero ve.
    await page.goto(`${baseUrl}/admin/pos`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[aria-label="Productos del local"]', { timeout: 30_000 });
    await page.waitForTimeout(900);
    await shot(page, `pos-catalogo-${label}`, viewport.name);

    // 4) El estado que cambió en esta rama: el producto agotado, visible y sin botón. A 375 px cae
    // debajo del pliegue, así que se captura aparte con la tarjeta centrada a la vista.
    const centrarAgotado = await page.evaluate(() => {
      const lista = document.querySelector('[aria-label="Productos del local"]');
      const tarjeta = Array.from(lista?.children ?? []).find((item) =>
        item.textContent?.includes("Agotado"),
      );

      if (!tarjeta) return false;

      tarjeta.scrollIntoView({ block: "center" });
      return true;
    });

    if (centrarAgotado) {
      await page.waitForTimeout(500);
      await shot(page, `pos-catalogo-agotado-${label}`, viewport.name);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

function save(file, contents) {
  const full = path.join(outputRoot, file);
  writeFileSync(full, `${contents}\n`, "utf8");
  console.log(`json: ${path.relative(repoRoot, full)}`);
}

async function shot(target, file, viewportName) {
  const full = path.join(outputRoot, `${file}-${viewportName}.png`);
  await target.screenshot({ path: full, fullPage: false });
  console.log(`captura: ${path.relative(repoRoot, full)}`);
}
