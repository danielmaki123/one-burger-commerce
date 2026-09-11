
/**
 * Carga del menú sin throttling: dónde está el tiempo y de dónde salen las fotos.
 * Solo lee: no modifica nada.
 *
 * Uso: node scripts/experiment-menu.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://oneburgernic.com/menu";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await context.newPage();

const startedAt = Date.now();
await page.goto(url, { waitUntil: "load" });
const loadMs = Date.now() - startedAt;

// Esperar a que aparezcan fotos de producto.
await page.waitForTimeout(6000);

const report = await page.evaluate(() => {
  const navigation = performance.getEntriesByType("navigation")[0];
  const resources = performance.getEntriesByType("resource");
  const images = resources
    .filter((entry) => entry.initiatorType === "img" || /\.(jpe?g|png|webp|avif)/i.test(entry.name))
    .map((entry) => ({
      host: new URL(entry.name).host,
      name: new URL(entry.name).pathname.slice(-32),
      kb: Math.round((entry.transferSize || entry.encodedBodySize || 0) / 1024),
      ms: Math.round(entry.duration),
    }));

  const byHost = Object.entries(
    images.reduce((acc, image) => {
      acc[image.host] = acc[image.host] ?? { count: 0, kb: 0, peorMs: 0 };
      acc[image.host].count += 1;
      acc[image.host].kb += image.kb;
      acc[image.host].peorMs = Math.max(acc[image.host].peorMs, image.ms);
      return acc;
    }, {}),
  ).map(([host, stats]) => ({ host, ...stats }));

  return {
    ttfbMs: Math.round(navigation.responseStart),
    domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
    loadMs: Math.round(navigation.loadEventEnd),
    imagenes: images.length,
    porHost: byHost,
    peores: [...images].sort((a, b) => b.ms - a.ms).slice(0, 8),
  };
});

console.log(JSON.stringify({ loadMedidoMs: loadMs, ...report }, null, 2));
await browser.close();
