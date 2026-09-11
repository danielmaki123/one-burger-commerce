/**
 * Sondas de interacción del mock completo del checkout (fase 0 de `TASK-checkout-v2`).
 *
 * El inventario de `scripts/audit-checkout-mock.mjs` dice cómo se ve el mock; esto dice si
 * **funciona**: usa los controles en un navegador real y compara el estado antes y después.
 * Es la evidencia de los puntos "no funcional" del informe `ops/audit-checkout-mock.md`.
 *
 * Uso:  node scripts/audit-checkout-mock-interactions.mjs
 */
/* global document, getComputedStyle */
/*
 * Los callbacks de `page.evaluate` no corren en Node: Playwright los serializa y los ejecuta
 * **dentro de la página**, así que ahí sí existen los globales del navegador. El resto del
 * archivo es Node.
 */
import path from "node:path";

import { chromium } from "@playwright/test";

const repoRoot = path.resolve(import.meta.dirname, "..");
const mockRoot = path.join(repoRoot, "stitch_full_pwa_builder", "stitch_full_pwa_builder");

const SCREENS = {
  checkout: "carrito_y_checkout_casa_antigua",
  confirm: "confirmaci_n_de_pedido_casa_antigua",
  menu: "men_gastron_mico_casa_antigua",
  customize: "personalizar_platillo_casa_antigua",
  history: "pedidos_anteriores_casa_antigua",
};

const browser = await chromium.launch();

async function open(name) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await page.goto(
    `file:///${path.join(mockRoot, SCREENS[name], "code.html").replace(/\\/g, "/")}`,
    { waitUntil: "networkidle", timeout: 45_000 },
  );
  // El mock compila Tailwind en el navegador: hay que dejarlo asentar antes de tocarlo.
  await page.waitForTimeout(2000);
  return { context, page };
}

/** Un selector que no existe no puede cortar el resto de la sonda. */
async function step(label, action) {
  try {
    console.log(`${label}: ${await action()}`);
  } catch (error) {
    console.log(`${label}: ERROR ${error.message.split("\n")[0]}`);
  }
}

/** Estado visual de todo lo que tiene cursor de mano, para comparar antes/después. */
const clickableState = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main *")]
      .filter((el) => getComputedStyle(el).cursor === "pointer")
      .map((el) => {
        const style = getComputedStyle(el);
        return [
          el.tagName,
          style.borderColor,
          style.borderWidth,
          style.backgroundColor,
          (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
        ].join("|");
      }),
  );

const bodyText = (page) =>
  page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

// ---------------------------------------------------------------- checkout
console.log("========== CHECKOUT (carrito + checkout en una pantalla) ==========");
{
  const { context, page } = await open("checkout");

  await step("inputs en el DOM", () =>
    page.$$eval("input, select, textarea", (els) => els.length || "(ninguno)"));
  await step("inputs de hora / selects", () =>
    page.$$eval("input[type=time], select", (els) => els.length || "(ninguno)"));
  await step("controles con cursor de mano", () => page.$$eval("main .cursor-pointer", (els) => els.length));

  const before = await clickableState(page);
  for (const [label, selector] of [
    ["click en la 2.ª sucursal", 'xpath=//*[contains(text(),"Managua Los Robles")]'],
    ["click en 'Tarjeta / POS'", 'xpath=//*[contains(text(),"Tarjeta / POS")]'],
    ["click en la propina del 10%", 'button:has-text("10%")'],
  ]) {
    await step(label, async () => {
      await page.locator(selector).last().click({ timeout: 3000 });
      await page.waitForTimeout(400);
      return "clickeado";
    });
  }
  const after = await clickableState(page);
  await step("¿algún control cambió de estado visual?", () =>
    JSON.stringify(before) === JSON.stringify(after)
      ? "NO: ninguno respondió"
      : `SÍ (${before.filter((value, index) => value !== after[index]).length} elementos)`);

  await step("click en el '+C$45' del upselling", async () => {
    await page.locator('button[aria-label^="Añadir"]').first().click({ timeout: 3000 });
    await page.waitForTimeout(400);
    return `badge del carrito: ${await page.$eval("header", (el) => el.innerText.replace(/\n/g, " "))}`;
  });
  await step("onclick del CTA 'Confirmar Pedido'", () =>
    page.$eval('button:has-text("Confirmar Pedido")', (el) => el.getAttribute("onclick") ?? "(sin acción)"));
  await step("click en 'Eliminar'", async () => {
    const items = await page.$$eval("main article", (els) => els.length);
    await page.locator('button[aria-label="Eliminar"]').first().click({ timeout: 3000 });
    await page.waitForTimeout(400);
    return `artículos ${items} → ${await page.$$eval("main article", (els) => els.length)}`;
  });
  await step("click en '+' de cantidad", async () => {
    const text = await bodyText(page);
    await page.locator('button[aria-label="Aumentar"]').first().click({ timeout: 3000 });
    await page.waitForTimeout(400);
    return text === (await bodyText(page)) ? "NO cambia el carrito" : "cambia el carrito";
  });

  await context.close();
}

// ------------------------------------------------------------ confirmación
console.log("\n========== CONFIRMACIÓN ==========");
{
  const { context, page } = await open("confirm");
  await step("acciones declaradas", () =>
    page.$$eval("button, a", (els) =>
      els
        .map(
          (el) =>
            `${el.tagName}[${(el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 22)}]→${
              el.getAttribute("onclick") ?? el.getAttribute("href") ?? "SIN ACCIÓN"
            }`,
        )
        .join(" | ")));
  await context.close();
}

// -------------------------------------------------------------------- menú
console.log("\n========== MENÚ ==========");
{
  const { context, page } = await open("menu");
  await step("tarjetas antes de buscar", () => page.$$eval("#menu-grid article", (els) => els.length));
  await step("escribir 'brownie' en el buscador", async () => {
    await page.fill("#menu-search-input", "brownie");
    await page.waitForTimeout(700);
    const total = await page.$$eval("#menu-grid article", (els) => els.length);
    const visibles = await page.$$eval("#menu-grid article", (els) =>
      els.filter((el) => el.getBoundingClientRect().height > 0).length);
    return `tarjetas en el DOM=${total} visibles=${visibles} (el filtro esconde, no borra)`;
  });
  await step("click en el '+' de un platillo (sin filtro)", async () => {
    await page.fill("#menu-search-input", "");
    await page.waitForTimeout(500);
    await page.locator(".add-dish-btn").first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
    const badge = await page.$eval("nav", (el) => el.innerText.replace(/\s+/g, " ").trim());
    return `badge del carrito tras agregar = ${badge}`;
  });
  await context.close();
}

// ---------------------------------------------------- personalizar platillo
console.log("\n========== PERSONALIZAR PLATILLO (la pantalla que sí funciona) ==========");
{
  const { context, page } = await open("customize");
  const cta = () => page.$eval('button[aria-label="Agregar al carrito"]', (el) => el.innerText.replace(/\s+/g, " ").trim());

  await step("CTA inicial", cta);
  await step("'+' de cantidad", async () => {
    await page.locator('button[aria-label="Aumentar cantidad"]').click({ timeout: 3000 });
    await page.waitForTimeout(400);
    return await cta();
  });
  await step("marcar '+C$35 Bacon Ahumado' por su etiqueta", async () => {
    await page.locator('label:has-text("Bacon Ahumado")').click({ timeout: 3000 });
    await page.waitForTimeout(400);
    return `${await cta()} (checkboxes marcados: ${await page.$$eval('input[name="extra_addon"]', (els) => els.filter((el) => el.checked).length)})`;
  });
  await step("cambiar a 'Doble Carne Smash +C$90'", async () => {
    await page.locator('label:has-text("Doble Carne Smash")').click({ timeout: 3000 });
    await page.waitForTimeout(400);
    return await cta();
  });
  await step("desmarcar el bacon", async () => {
    await page.locator('label:has-text("Bacon Ahumado")').click({ timeout: 3000 });
    await page.waitForTimeout(400);
    return await cta();
  });
  await step("el input nativo, ¿es clickeable directamente?", async () => {
    await page.locator('input[name="extra_addon"]').first().check({ timeout: 3000 });
    return "sí";
  });
  await step("click en 'Agregar al carrito'", async () => {
    await page.locator('button[aria-label="Agregar al carrito"]').click({ timeout: 3000 });
    await page.waitForTimeout(800);
    return /agregado/i.test(await bodyText(page)) ? "aparece el aviso" : "sin aviso";
  });
  await context.close();
}

// --------------------------------------------------------------- historial
console.log("\n========== HISTORIAL (pedidos anteriores) ==========");
{
  const { context, page } = await open("history");
  await step("bloques antes de buscar", () => page.$$eval("main .rounded-2xl", (els) => els.length));
  await step("escribir 'CA-4682' en el buscador", async () => {
    await page.locator("main input[type=text]").fill("CA-4682");
    await page.waitForTimeout(700);
    const total = await page.$$eval("main .rounded-2xl", (els) => els.length);
    const visibles = await page.$$eval("main .rounded-2xl", (els) =>
      els.filter((el) => el.getBoundingClientRect().height > 0).length);
    return `bloques en el DOM=${total} visibles=${visibles} (no filtra)`;
  });
  await step("click en 'Pedir nuevamente'", async () => {
    await page.locator('button:has-text("Pedir nuevamente")').first().click({ timeout: 3000 });
    await page.waitForTimeout(800);
    return /duplicad|carrito/i.test(await bodyText(page)) ? "aparece el aviso de duplicado" : "sin aviso";
  });
  await context.close();
}

await browser.close();
