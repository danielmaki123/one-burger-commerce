/* global document */
/**
 * Primera visita vs segunda visita (caché tibio) en celular con datos lentos.
 * Solo lee: no modifica nada.
 *
 * Uso: node scripts/experiment-landing-cache.mjs [url]
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

const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 400,
  downloadThroughput: (400 * 1024) / 8,
  uploadThroughput: (400 * 1024) / 8,
});

async function visit(label) {
  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "commit" });

  const firstFrameVisibleMs = await page
    .waitForFunction(
      () => {
        const image = document.getElementById("landing-frame");
        return Boolean(image && image.complete && image.naturalWidth > 0);
      },
      { timeout: 60000 },
    )
    .then(() => Date.now() - startedAt)
    .catch(() => null);

  await page.waitForTimeout(2000);

  const stats = await page.evaluate(() => {
    const frames = performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/landing/frames/"));
    const revalidated = frames.filter((entry) => entry.transferSize > 0).length;
    return {
      framesPedidas: frames.length,
      framesQueBajaronBytes: revalidated,
      kbFrames: Math.round(
        frames.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024,
      ),
    };
  });

  return { visita: label, firstFrameVisibleMs, ...stats };
}

const primera = await visit("primera");
const segunda = await visit("segunda (caché tibio)");
const tercera = await visit("tercera");

console.log(JSON.stringify({ primera, segunda, tercera }, null, 2));
await browser.close();
