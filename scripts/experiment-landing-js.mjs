/* global window, document */
/**
 * ¿Qué hace lenta la carga: el JavaScript (y sus re-renders) o la red?
 *
 * Compara el mismo escenario con y sin los chunks de JS, y mide el trabajo de
 * main thread. Solo lee: no modifica nada.
 *
 * Uso: node scripts/experiment-landing-js.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://oneburgernic.com/landing";

async function run({ blockScripts }) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  if (blockScripts) {
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
  }

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });

  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__longTasks.push(Math.round(entry.duration));
      }
    }).observe({ type: "longtask", buffered: true });
  });

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

  await page.waitForTimeout(3000);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource");
    const scripts = resources.filter((entry) => entry.initiatorType === "script");
    return {
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      scriptKb: Math.round(
        scripts.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0) /
          1024,
      ),
      longTasks: window.__longTasks ?? [],
      totalLongTaskMs: (window.__longTasks ?? []).reduce((sum, value) => sum + value, 0),
    };
  });

  await browser.close();
  return { blockScripts, firstFrameVisibleMs, ...metrics };
}

const withJs = await run({ blockScripts: false });
const withoutJs = await run({ blockScripts: true });

console.log(JSON.stringify({ conJavaScript: withJs, sinJavaScript: withoutJs }, null, 2));
console.log(
  `\nprimera frame: con JS ${withJs.firstFrameVisibleMs} ms · sin JS ${withoutJs.firstFrameVisibleMs} ms`,
);
console.log(`JS descargado: ${withJs.scriptKb} KB · trabajo de main thread: ${withJs.totalLongTaskMs} ms`);
