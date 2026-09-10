/* global document */
/**
 * Landing en el escenario real de un cliente: celular con datos lentos.
 * Solo lee: no modifica nada.
 *
 * Uso: node scripts/audit-landing-mobile.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://oneburgernic.com/landing";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();

// Slow 4G: 400 kbps de bajada, 400 ms de latencia (lo que ve un cliente en la calle).
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 400,
  downloadThroughput: (400 * 1024) / 8,
  uploadThroughput: (400 * 1024) / 8,
});

const frames = [];
const startedAt = Date.now();
page.on("response", (response) => {
  const path = new URL(response.url()).pathname;
  if (path.startsWith("/landing/frames/")) {
    frames.push({ path: path.split("/").pop(), at: Date.now() - startedAt });
  }
});

await page.goto(url, { waitUntil: "commit" });

// ¿Cuánto tarda en verse la hamburguesa?
const firstFrameVisibleAt = await page
  .waitForFunction(
    () => {
      const image = document.getElementById("landing-frame");
      return Boolean(image && image.complete && image.naturalWidth > 0);
    },
    { timeout: 60000 },
  )
  .then(() => Date.now() - startedAt)
  .catch(() => null);

await page.waitForTimeout(6000);

const lcp = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const entries = performance.getEntriesByType("largest-contentful-paint");
      resolve(entries.length ? Math.round(entries[entries.length - 1].startTime) : null);
    }),
);

const totals = await page.evaluate(() => {
  const resources = performance.getEntriesByType("resource").filter((entry) =>
    entry.name.includes("/landing/frames/"),
  );
  return {
    framesRequested: resources.length,
    framesKb: Math.round(
      resources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0) /
        1024,
    ),
  };
});

console.log(
  JSON.stringify(
    {
      primeraFrameVisibleMs: firstFrameVisibleAt,
      lcpMs: lcp,
      framesDescargados: totals.framesRequested,
      framesKb: totals.framesKb,
      secuenciaDeCarga: frames.slice(0, 12),
    },
    null,
    2,
  ),
);

await browser.close();
