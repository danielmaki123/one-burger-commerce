/**
 * Auditoría del mock completo del checkout (Stitch export "Casa Antigua").
 *
 * Mide el mock en un navegador real (no HTML estático) a 375 px y 1280 px y emite un
 * inventario estructurado: textos, controles con su caja real, objetivos táctiles por
 * debajo de 44 px, contraste WCAG, desborde horizontal, elementos fijos, imágenes rotas
 * y recursos externos que el build hermético no tiene.
 *
 * Uso:  node scripts/audit-checkout-mock.mjs
 * Salida: test-results/mock-audit/inventory.json + capturas por pantalla y resolución.
 */
/* global document, getComputedStyle, location, window, NodeFilter, Node */
/*
 * `collectInventory` no corre en Node: Playwright lo serializa y lo ejecuta **dentro de la
 * página**, así que ahí sí existen los globales del navegador. El resto del archivo es Node.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const mockRoot = path.join(repoRoot, "stitch_full_pwa_builder", "stitch_full_pwa_builder");
const outputRoot = path.join(repoRoot, "test-results", "mock-audit");

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 900 },
];

/** Todo lo que se mide dentro de la página, en una sola pasada. */
function collectInventory() {
  const MIN_TOUCH = 44;

  const isVisible = (el) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const boxOf = (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  };

  const textOf = (el) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

  const parseColor = (value) => {
    const match = /rgba?\(([^)]+)\)/.exec(value ?? "");
    if (!match) return null;
    const [r, g, b, a = "1"] = match[1].split(",").map((part) => Number(part.trim()));
    return { r, g, b, a };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  const contrast = (fg, bg) => {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  };

  const flatten = (fg, bg) => ({
    r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
    g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
    b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
    a: 1,
  });

  /**
   * Fondo efectivo: sube por los ancestros hasta un color opaco. Devuelve también si en
   * el camino había un degradado o una imagen de fondo: en ese caso el color de fondo es
   * transparente y el contraste calculado no es confiable, así que el informe no puede
   * afirmarlo.
   */
  const effectiveBackground = (el) => {
    let current = el;
    let collected = null;
    let overImage = false;

    while (current) {
      const style = getComputedStyle(current);
      const hasImage =
        style.backgroundImage !== "none" && !style.backgroundImage.startsWith("url(\"data:image/svg+xml");
      if (hasImage) overImage = true;

      const color = parseColor(style.backgroundColor);
      if (color && color.a > 0) {
        collected = collected ? flatten(collected, color) : color;
        if (collected.a >= 0.999) return { color: collected, overImage };
      }
      current = current.parentElement;
    }

    const bodyColor = parseColor(getComputedStyle(document.body).backgroundColor);
    return {
      color: collected ? flatten(collected, bodyColor ?? { r: 255, g: 255, b: 255, a: 1 }) : bodyColor,
      overImage,
    };
  };

  const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(isVisible);
  const headingTexts = headings.map((h) => ({
    level: Number(h.tagName[1]),
    text: textOf(h),
    box: boxOf(h),
  }));

  /** Encabezado que precede al elemento en el documento. */
  const sectionOf = (el) => {
    let best = null;
    for (const heading of headings) {
      if (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        best = heading;
      }
    }
    return best ? `${best.tagName.toLowerCase()}: ${textOf(best)}` : "(sin encabezado)";
  };

  const textLeaves = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const raw = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
    const parent = node.parentElement;

    if (raw && parent && isVisible(parent)) {
      const style = getComputedStyle(parent);
      const isIcon = parent.closest(".material-symbols-outlined, .material-symbols-rounded");
      const fg = parseColor(style.color);
      const background = effectiveBackground(parent);
      const fontSize = Number.parseFloat(style.fontSize);
      const fontWeight = Number(style.fontWeight) || 400;
      const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);

      textLeaves.push({
        text: raw,
        section: sectionOf(parent),
        tag: parent.tagName.toLowerCase(),
        box: boxOf(parent),
        fontSize: Math.round(fontSize * 10) / 10,
        fontWeight,
        color: style.color,
        isIcon: Boolean(isIcon),
        contrast: fg && background.color ? contrast(fg, background.color) : null,
        // Sobre un degradado el fondo real no es un color plano: no se afirma contraste.
        contrastUnreliable: background.overImage,
        requiredContrast: isLarge ? 3 : 4.5,
      });
    }

    node = walker.nextNode();
  }

  const controls = [];
  const controlSelector =
    "button, a[href], input, select, textarea, [role=button], [role=radio], [role=checkbox], [onclick], label";
  for (const el of document.querySelectorAll(controlSelector)) {
    if (!isVisible(el)) continue;

    const style = getComputedStyle(el);
    const box = boxOf(el);
    const label =
      el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? textOf(el) ?? "";

    controls.push({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type"),
      name: (label || "").slice(0, 80),
      section: sectionOf(el),
      box,
      href: el.getAttribute("href"),
      hasOnclick: el.hasAttribute("onclick"),
      inputId: el.id || null,
      inputName: el.getAttribute("name"),
      cursor: style.cursor,
      fontSize: Math.round(Number.parseFloat(style.fontSize) * 10) / 10,
      belowTouchTarget: box.width < MIN_TOUCH || box.height < MIN_TOUCH,
      hasVisibleLabelAssociation:
        el.tagName === "LABEL" ? Boolean(el.getAttribute("for") || el.querySelector("input")) : null,
    });
  }

  const inputs = [...document.querySelectorAll("input, select, textarea")]
    .filter(isVisible)
    .map((el) => ({
      type: el.getAttribute("type") ?? el.tagName.toLowerCase(),
      name: el.getAttribute("name"),
      placeholder: el.getAttribute("placeholder"),
      required: el.hasAttribute("required"),
      id: el.id || null,
      hasLabel: Boolean(
        (el.id && document.querySelector(`label[for="${el.id}"]`)) ||
          el.closest("label") ||
          el.getAttribute("aria-label"),
      ),
      box: boxOf(el),
    }));

  const images = [...document.querySelectorAll("img")].map((img) => ({
    alt: img.getAttribute("alt"),
    host: (() => {
      try {
        return new URL(img.src, location.href).host;
      } catch {
        return null;
      }
    })(),
    naturalWidth: img.naturalWidth,
    rendered: boxOf(img),
    broken: img.complete && img.naturalWidth === 0,
    lazy: img.getAttribute("loading") ?? "eager",
  }));

  const fixedOrSticky = [...document.querySelectorAll("*")]
    .filter((el) => ["fixed", "sticky"].includes(getComputedStyle(el).position) && isVisible(el))
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      position: getComputedStyle(el).position,
      box: boxOf(el),
      zIndex: getComputedStyle(el).zIndex,
      text: textOf(el).slice(0, 60),
    }));

  const externalHosts = [
    ...new Set(
      performance
        .getEntriesByType("resource")
        .map((entry) => {
          try {
            return new URL(entry.name).host;
          } catch {
            return null;
          }
        })
        .filter((host) => host && host !== location.host),
    ),
  ].sort();

  const duplicates = Object.entries(
    textLeaves
      .filter((leaf) => !leaf.isIcon && leaf.text.length > 2)
      .reduce((acc, leaf) => {
        acc[leaf.text] = (acc[leaf.text] ?? 0) + 1;
        return acc;
      }, {}),
  )
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  const currencyTokens = [
    ...new Set(
      textLeaves
        .map((leaf) => leaf.text.match(/(?:C\$|US\$|\$|MXN|NIO)\s?[\d.,]+/g))
        .filter(Boolean)
        .flat(),
    ),
  ];

  const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null;
  const missingAlt = images.filter((img) => !img.alt || img.alt.trim() === "").length;

  /**
   * Controles "falsos": elementos que se ven y se comportan como un control (cursor de
   * mano) pero no son botones ni inputs, así que no se pueden alcanzar con el teclado ni
   * tienen semántica para un lector de pantalla.
   */
  const nativeInteractive = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL", "SUMMARY"]);
  const fakeControls = [...document.querySelectorAll("*")]
    .filter(
      (el) =>
        isVisible(el) &&
        getComputedStyle(el).cursor === "pointer" &&
        !nativeInteractive.has(el.tagName) &&
        !el.closest("button, a, label"),
    )
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: textOf(el).slice(0, 60),
      section: sectionOf(el),
      role: el.getAttribute("role"),
      tabIndex: el.tabIndex,
      box: boxOf(el),
    }));

  const focusables = [
    ...document.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(isVisible);

  const shells = [
    ...document.body.children,
    ...(document.body.firstElementChild ? [...document.body.firstElementChild.children] : []),
  ]
    .filter(isVisible)
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      className: String(el.className ?? "").slice(0, 90),
      box: boxOf(el),
      maxWidth: getComputedStyle(el).maxWidth,
    }));

  const widestElement =
    [...document.querySelectorAll("*")]
      .filter(isVisible)
      .map((el) => ({ box: boxOf(el), tag: el.tagName.toLowerCase(), text: textOf(el).slice(0, 40) }))
      .sort((a, b) => b.box.width - a.box.width)[0] ?? null;

  const fixedBoxes = [...document.querySelectorAll("*")]
    .filter((el) => isVisible(el) && getComputedStyle(el).position === "fixed")
    .map((el) => boxOf(el));
  const lowestFixed = fixedBoxes.sort((a, b) => b.y - a.y)[0] ?? null;
  const navElement = [...document.querySelectorAll("nav")].filter(isVisible)[0] ?? null;
  const navBox = navElement ? boxOf(navElement) : null;
  if (navBox) {
    navBox.insideViewport = navBox.y + navBox.height <= window.innerHeight;
  }
  const contentBottom = [...document.querySelectorAll("main *")]
    .filter(isVisible)
    .reduce((max, el) => Math.max(max, boxOf(el).y + boxOf(el).height), 0);

  // Foco del CTA principal: si el mock no declara un anillo visible, con teclado no se ve
  // dónde está parado el usuario.
  const primaryCta =
    [...document.querySelectorAll("button")]
      .filter(isVisible)
      .sort((a, b) => {
        const boxA = boxOf(a);
        const boxB = boxOf(b);
        return boxB.width * boxB.height - boxA.width * boxA.height;
      })[0] ?? null;
  let primaryCtaFocus = null;
  if (primaryCta) {
    primaryCta.focus();
    const style = getComputedStyle(primaryCta);
    primaryCtaFocus = {
      text: textOf(primaryCta).slice(0, 50),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow.slice(0, 70),
    };
    primaryCta.blur();
  }

  const landmarks = {
    header: document.querySelectorAll("header").length,
    main: document.querySelectorAll("main").length,
    nav: document.querySelectorAll("nav").length,
    footer: document.querySelectorAll("footer").length,
    aside: document.querySelectorAll("aside").length,
  };

  const aria = {
    labels: document.querySelectorAll("[aria-label]").length,
    current: document.querySelectorAll("[aria-current]").length,
    live: document.querySelectorAll("[aria-live]").length,
    expanded: document.querySelectorAll("[aria-expanded]").length,
    hidden: document.querySelectorAll("[aria-hidden]").length,
    roles: document.querySelectorAll("[role]").length,
    describedBy: document.querySelectorAll("[aria-describedby]").length,
    invalid: document.querySelectorAll("[aria-invalid]").length,
  };

  const tipButtons = [...document.querySelectorAll("button")]
    .filter((el) => isVisible(el) && /^\s*\d{1,2}\s?%\s*$/.test(textOf(el)))
    .map((el) => ({
      text: textOf(el),
      background: getComputedStyle(el).backgroundColor,
      box: boxOf(el),
    }));

  return {
    fakeControls,
    focusableCount: focusables.length,
    fakeControlCount: fakeControls.length,
    shells,
    widestElement,
    lowestFixed,
    navBox,
    viewportHeight: window.innerHeight,
    contentBottom,
    primaryCtaFocus,
    landmarks,
    aria,
    tipButtons,
    zoomBlocked: /user-scalable=no|maximum-scale=1(\.0)?\b/.test(viewportMeta ?? ""),
    title: document.title,
    lang: document.documentElement.lang,
    viewportMeta,
    bodyText: document.body.innerText.replace(/\n{2,}/g, "\n").slice(0, 4000),
    headings: headingTexts,
    textLeaves,
    controls,
    inputs,
    images,
    fixedOrSticky,
    externalHosts,
    duplicates,
    currencyTokens,
    measurements: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      documentHeight: document.documentElement.scrollHeight,
      controlsBelowTouchTarget: controls.filter((c) => c.belowTouchTarget).length,
      textsBelowContrast: textLeaves.filter((t) => t.contrast !== null && t.contrast < t.requiredContrast).length,
      brokenImages: images.filter((i) => i.broken).length,
      imagesMissingAlt: missingAlt,
      iconFontLoaded: document.fonts.check('24px "Material Symbols Outlined"'),
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      tailwindApplied: getComputedStyle(document.querySelector("body > div") ?? document.body).display !== "block",
    },
  };
}

const screens = readdirSync(mockRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => readdirSync(path.join(mockRoot, name)).includes("code.html"))
  .sort();

mkdirSync(outputRoot, { recursive: true });

const browser = await chromium.launch();
const report = { generatedAt: new Date().toISOString(), mockRoot, screens: {} };

for (const screen of screens) {
  const fileUrl = `file:///${path.join(mockRoot, screen, "code.html").replace(/\\/g, "/")}`;
  report.screens[screen] = { fileUrl };

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    try {
      await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 45_000 });
    } catch {
      // El mock carga Tailwind desde un CDN: si la red tarda, se sigue igual y se mide
      // lo que haya (queda registrado en `loadError`).
      report.screens[screen][`${viewport.name}LoadError`] = true;
    }

    // Tailwind CDN compila en el navegador: hay que dejarlo asentar.
    await page.waitForTimeout(2500);

    const inventory = await page.evaluate(collectInventory);
    report.screens[screen][viewport.name] = inventory;

    await page.screenshot({
      path: path.join(outputRoot, `${screen}-${viewport.name}.png`),
      fullPage: true,
    });

    await context.close();
  }
}

await browser.close();

writeFileSync(path.join(outputRoot, "inventory.json"), JSON.stringify(report, null, 2), "utf8");

// Resumen compacto por consola: lo que se lee para escribir el informe.
for (const [screen, data] of Object.entries(report.screens)) {
  for (const viewport of VIEWPORTS) {
    const inventory = data[viewport.name];
    if (!inventory) continue;
    const m = inventory.measurements;

    console.log(`\n=== ${screen} · ${viewport.name} (${viewport.width}px) ===`);
    console.log(`title="${inventory.title}" lang=${inventory.lang}`);
    console.log(`viewport meta: ${inventory.viewportMeta}`);
    console.log(`tailwind=${m.tailwindApplied} iconFont=${m.iconFontLoaded} font=${m.bodyFontFamily}`);
    console.log(
      `overflow=${m.hasHorizontalOverflow} (${m.scrollWidth}/${m.clientWidth}) alto=${m.documentHeight}px`,
    );
    console.log(
      `controles=${inventory.controls.length} bajo44px=${m.controlsBelowTouchTarget} contrasteBajo=${m.textsBelowContrast} imgsRotas=${m.brokenImages}/${inventory.images.length} sinAlt=${m.imagesMissingAlt}`,
    );
    console.log(`fijos/sticky=${inventory.fixedOrSticky.length} hostsExternos=${inventory.externalHosts.join(", ")}`);
    console.log(
      `foco: ${inventory.focusableCount} focusables, ${inventory.fakeControlCount} controles falsos (div con cursor de mano)`,
    );
    console.log(
      `zoomBloqueado=${inventory.zoomBlocked} landmarks=${JSON.stringify(inventory.landmarks)} aria=${JSON.stringify(inventory.aria)}`,
    );
    console.log(
      `fijos: ${JSON.stringify(inventory.lowestFixed)} · contenidoTerminaEn=${inventory.contentBottom}`,
    );
    console.log(
      `CTA principal al enfocar: ${JSON.stringify(inventory.primaryCtaFocus)}`,
    );
    console.log(`masAncho: ${JSON.stringify(inventory.widestElement?.box)} <${inventory.widestElement?.tag}> "${inventory.widestElement?.text}"`);
    console.log(`tip: ${JSON.stringify(inventory.tipButtons)}`);
    console.log(`contenedores: ${inventory.shells.map((s) => `${s.tag}.${s.className.slice(0, 30)} ${s.box.width}x${s.box.height} maxW=${s.maxWidth}`).join(" | ")}`);
    if (inventory.fakeControls.length > 0) {
      console.log("controles falsos (no enfocables):");
      for (const fake of inventory.fakeControls.slice(0, 14)) {
        console.log(`  <${fake.tag}> "${fake.text}" role=${fake.role} tabIndex=${fake.tabIndex} ${fake.box.width}x${fake.box.height}`);
      }
    }
    console.log(`moneda: ${inventory.currencyTokens.join(" | ")}`);
    console.log(`duplicados: ${inventory.duplicates.slice(0, 12).map(([t, c]) => `${c}×"${t}"`).join(", ")}`);
    const reliableLow = inventory.textLeaves.filter(
      (t) => !t.isIcon && t.contrast !== null && t.contrast < t.requiredContrast && !t.contrastUnreliable,
    );
    const explicitLow = inventory.textLeaves.filter(
      (t) => !t.isIcon && t.contrast !== null && t.contrast < t.requiredContrast && t.contrastUnreliable,
    );
    console.log(
      `contraste: ${reliableLow.length} fallos verificables, ${explicitLow.length} sobre degradado (no verificable)`,
    );
    for (const low of reliableLow.slice(0, 8)) {
      console.log(
        `  ${low.contrast}:1 (min ${low.requiredContrast}) ${low.fontSize}px/${low.fontWeight} :: "${low.text.slice(0, 55)}"`,
      );
    }
    console.log(`nav: ${JSON.stringify(inventory.navBox)} (viewport ${inventory.viewportHeight}px)`);
    console.log("encabezados:");
    for (const h of inventory.headings) console.log(`  h${h.level} ${h.text}`);
    console.log("controles:");
    for (const c of inventory.controls) {
      console.log(
        `  ${c.tag}${c.type ? `[${c.type}]` : ""} "${c.name}" ${c.box.width}x${c.box.height}${c.belowTouchTarget ? " (bajo 44)" : ""}${c.hasOnclick ? " [onclick]" : ""}${c.href ? ` href=${c.href}` : ""}`,
      );
    }
  }
}

console.log(`\nJSON completo: ${path.relative(repoRoot, path.join(outputRoot, "inventory.json"))}`);
