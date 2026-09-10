/* global location */
/**
 * Cascada de carga del landing en celular con datos lentos.
 * Solo lee: no modifica nada.
 *
 * Uso: node scripts/audit-landing-waterfall.mjs [url]
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

await page.goto(url, { waitUntil: "commit" });
await page.waitForTimeout(14000);

const report = await page.evaluate(() => {
  const navigation = performance.getEntriesByType("navigation")[0];
  const resources = performance.getEntriesByType("resource").map((entry) => ({
    name: entry.name
      .replace(location.origin, "")
      .replace(/^\/_next\/static\/[^/]+\//, "/_next/…/"),
    type: entry.initiatorType,
    kb: Math.round((entry.transferSize || entry.encodedBodySize || 0) / 1024),
    startMs: Math.round(entry.startTime),
    endMs: Math.round(entry.responseEnd),
    durationMs: Math.round(entry.duration),
  }));

  return {
    navigation: {
      ttfbMs: Math.round(navigation.responseStart),
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      loadMs: Math.round(navigation.loadEventEnd),
      transferKb: Math.round((navigation.transferSize || 0) / 1024),
    },
    totalKb: resources.reduce((sum, r) => sum + r.kb, 0),
    byType: Object.entries(
      resources.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] ?? 0) + r.kb;
        return acc;
      }, {}),
    )
      .map(([type, kb]) => ({ type, kb }))
      .sort((a, b) => b.kb - a.kb),
    heaviest: [...resources].sort((a, b) => b.kb - a.kb).slice(0, 12),
    lastToFinish: [...resources].sort((a, b) => b.endMs - a.endMs).slice(0, 6),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
