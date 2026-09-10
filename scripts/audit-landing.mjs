/* global window, document, requestAnimationFrame */
/**
 * Auditoría técnica del landing. Solo lee: no modifica nada.
 *
 * Uso: node scripts/audit-landing.mjs [url]
 */
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "https://oneburgernic.com/landing";

function luminance(hex) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

const browser = await chromium.launch();
const results = {};

try {
  // --- Escritorio ---------------------------------------------------------
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  const framesTransferred = [];
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/landing/frames/")) {
      const size = Number(response.headers()["content-length"] ?? 0);
      framesTransferred.push({ path, size, status: response.status() });
    }
  });

  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "load" });
  results.loadMs = Date.now() - startedAt;
  await page.waitForTimeout(1500);

  results.button = await page.locator(".landing-menu-button").evaluate((element) => {
    const style = window.getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      letterSpacing: style.letterSpacing,
      color: style.color,
      backgroundImage: style.backgroundImage.slice(0, 120),
      border: style.border,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      textTransform: style.textTransform,
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  });

  // ¿El peso 950 llega a renderizar distinto que 700? Si miden igual, la fuente
  // no tiene ese peso y el navegador lo recorta.
  results.weightProbe = await page.locator(".landing-menu-button").evaluate((element) => {
    const probe = document.createElement("span");
    probe.textContent = "MENU";
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
    element.parentElement.appendChild(probe);
    const widthAt = (weight) => {
      probe.style.fontFamily = window.getComputedStyle(element).fontFamily;
      probe.style.fontSize = window.getComputedStyle(element).fontSize;
      probe.style.letterSpacing = window.getComputedStyle(element).letterSpacing;
      probe.style.fontWeight = String(weight);
      return Math.round(probe.getBoundingClientRect().width * 100) / 100;
    };
    const measured = { w400: widthAt(400), w700: widthAt(700), w900: widthAt(900), w950: widthAt(950) };
    probe.remove();
    return measured;
  });

  // ¿Se puede scroll horizontal?
  results.horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  // Elementos que reciben foco (para el orden de tabulación).
  results.focusables = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href], button, [tabindex]")).map((element) => ({
      tag: element.tagName,
      label: element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 30),
      hidden: element.getAttribute("aria-hidden"),
    })),
  );

  // El texto de ayuda, ¿se anuncia a un lector de pantalla?
  results.scrollHint = await page.locator(".landing-scroll-hint").evaluate((element) => ({
    text: element.textContent?.trim(),
    ariaHidden: element.getAttribute("aria-hidden"),
    fontSize: window.getComputedStyle(element).fontSize,
  }));

  // LCP y peso real de los frames.
  results.lcp = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const entries = performance.getEntriesByType("largest-contentful-paint");
        if (entries.length > 0) return resolve(Math.round(entries[entries.length - 1].startTime));
        const observer = new PerformanceObserver((list) => {
          const last = list.getEntries().at(-1);
          resolve(Math.round(last.startTime));
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => resolve(null), 1200);
      }),
  );

  // Costo de cambiar de frame: ¿el salto de 83->113 cuánto mueve la imagen?
  results.scrollMapping = await page.evaluate(async () => {
    const stage = document.getElementById("landing-stage");
    const frame = document.getElementById("landing-frame");
    const scrollable = stage.getBoundingClientRect().height - window.innerHeight;
    const samples = [];
    for (const ratio of [0, 0.5, 0.63, 0.64, 0.99, 1]) {
      window.scrollTo({ top: scrollable * ratio, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push({ ratio, src: frame.getAttribute("src")?.split("/").pop() });
    }
    return samples;
  });

  results.frames = {
    count: framesTransferred.length,
    totalKb: Math.round(framesTransferred.reduce((sum, f) => sum + f.size, 0) / 1024),
    failures: framesTransferred.filter((f) => f.status !== 200).length,
  };

  await desktop.close();

  // --- Móvil --------------------------------------------------------------
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(url, { waitUntil: "load" });
  await mobilePage.waitForTimeout(500);

  results.mobile = await mobilePage.evaluate(() => {
    const scene = document.querySelector(".landing-scene");
    return {
      innerHeight: window.innerHeight,
      visualViewportHeight: Math.round(window.visualViewport?.height ?? 0),
      sceneHeight: Math.round(scene.getBoundingClientRect().height),
      sceneOverflowsViewport:
        Math.round(scene.getBoundingClientRect().height) > (window.visualViewport?.height ?? window.innerHeight),
      shellMinHeight: window.getComputedStyle(document.querySelector(".landing-shell")).minHeight,
    };
  });

  await mobile.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
console.log("\n--- contraste del label del botón ---");
console.log("sobre cheese #f9c94d:", contrast("#1b1007", "#f9c94d"));
console.log("sobre ember  #ffad3d:", contrast("#1b1007", "#ffad3d"));
