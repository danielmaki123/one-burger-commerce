import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * `SCREEN-POS-QUICK-SALE-001.2` — la **geometría real** del ticket de Venta rápida.
 *
 * Por qué existe: los tests del workspace verifican clases y DOM, y eso **no** alcanzaba. La versión
 * anterior tenía las clases "correctas" (`overflow-y-auto` en las líneas) y aun así, con tres productos, la
 * zona de líneas quedaba en **34 px** —menos de una fila de 57— por la negociación del `flex` contra un
 * checkout de 887 px de contenido: había que scrollear para ver el tercer producto. Este test mide el
 * navegador de verdad, que es la única forma de detectar ese defecto.
 *
 * Dos casos, porque son dos comportamientos distintos y los dos importan:
 *
 * - **Nominal** (1–3 líneas): las tres filas se ven **completas**, la lista **no** tiene scroll propio, el
 *   total / la forma de pago / el `Cobrar` están a la vista y la página no scrollea para cobrar.
 * - **Overflow real** (más líneas de las que entran): el scroll aparece **solo** en la lista de líneas, el
 *   CTA sigue visible y el checkout no desaparece.
 *
 * Se corre con sesión de admin (`E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`): el POS vive detrás del login.
 */

const DESKTOP = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

const TODOS = [...DESKTOP, { width: 768, height: 1024 }, { width: 375, height: 812 }];

type Geometry = {
  zona: { top: number; bottom: number; client: number; scroll: number };
  filas: { bottom: number; visibleEntera: boolean }[];
  checkout: { client: number; scroll: number };
  totalVisible: boolean;
  pagoVisible: boolean;
  /** Cuánto falta scrollear el checkout para que la forma de pago entre en su primer viewport (0 = ya entra). */
  pagoOffset: number | null;
  cobrarVisible: boolean;
  cobrarBottom: number | null;
  overflowX: number;
  pageScroll: number;
  sheetAbierto: boolean;
};

/**
 * Agrega un producto por **nombre** hasta llegar a `count`, salteando los que abren el selector de
 * modificadores (ahí el «+» de la tarjeta no entra directo a la venta).
 *
 * Se itera por nombre y no por índice de botón a propósito: la lista de `Agregar …` se re-renderiza con cada
 * alta y un índice guardado apunta a otra tarjeta. La señal de que la línea entró es el **total de la barra
 * inferior** (`Ver venta · C$…`), porque abajo de `lg` y con el sheet cerrado la lista de líneas no existe en
 * el DOM: el contenido del panel se desmonta.
 */
async function agregarProductos(page: Page, count: number): Promise<void> {
  const nombres = await page
    .locator('[aria-label="Productos del local"] > li')
    .evaluateAll((tarjetas) =>
      tarjetas
        .map((tarjeta) => tarjeta.querySelector("p")?.textContent?.trim() ?? "")
        .filter(Boolean),
    );
  let puestas = 0;

  for (const nombre of nombres) {
    if (puestas >= count) break;

    const antes = await totalEnPantalla(page);
    await page.getByRole("button", { name: `Agregar ${nombre} a la venta`, exact: true }).click();
    await page.waitForTimeout(300);

    if (await selectorDeModificadoresAbierto(page)) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      continue;
    }

    const despues = await totalEnPantalla(page);
    if (despues !== antes) puestas += 1;
  }

  if (puestas < count) {
    throw new Error(`La carta no alcanzó para ${count} líneas distintas (quedaron ${puestas}).`);
  }
}

/** El total que la pantalla muestra hoy, sin importar el layout: el `Total` del ticket o el de la barra. */
async function totalEnPantalla(page: Page): Promise<string> {
  return page.evaluate(() => {
    const alternativas = [
      document.querySelector('[data-testid="pos-sale-total"]')?.textContent,
      document.querySelector('[data-pos-sale-sheet-trigger="true"]')?.getAttribute("aria-label"),
    ].filter(Boolean);

    return alternativas.join("|");
  });
}

/**
 * ¿Está abierto el selector de modificadores?
 *
 * Se mira el **contenido** y no el nombre del diálogo: el del POS también está abierto en el DOM y filtrar
 * por texto es frágil (el nombre accesible del panel cambia de forma entre escritorio y sheet). El selector
 * de modificadores es el único que dice `Queda en`.
 */
async function selectorDeModificadoresAbierto(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    [...document.querySelectorAll("dialog[open]")].some((dialogo) =>
      (dialogo.textContent ?? "").includes("Queda en"),
    ),
  );
}

async function medirTicket(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const zona = document.querySelector('[data-testid="pos-sale-lines-zone"]') as HTMLElement | null;
    const checkout = document.querySelector(
      '[data-testid="pos-sale-checkout-zone"]',
    ) as HTMLElement | null;
    const panel = document.querySelector('[data-testid="pos-sale-pane"]') as HTMLElement | null;

    if (!zona || !checkout || !panel) {
      throw new Error("El panel de venta no está montado.");
    }

    const zonaRect = zona.getBoundingClientRect();
    const filas = [...document.querySelectorAll('[aria-label="Productos de la venta"] > li')].map(
      (fila) => {
        const rect = fila.getBoundingClientRect();
        return {
          bottom: Math.round(rect.bottom),
          visibleEntera:
            rect.bottom <= zonaRect.bottom + 0.5 && rect.top >= zonaRect.top - 0.5,
        };
      },
    );

    const visible = (element: Element | null) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom <= window.innerHeight + 0.5;
    };

    const botones = [...document.querySelectorAll("button")];
    const cobrar = botones.find((node) => /^Cobrar/.test(node.textContent ?? "")) ?? null;
    const pago = botones.find((node) => node.textContent?.trim() === "Efectivo") ?? null;

    /*
      La forma de pago tiene que estar **alcanzable en el primer viewport del checkout**: acá se mide cuánto
      falta scrollearlo para que entre. Es 0 cuando ya entra; con muchos productos o una carta más larga no
      se exige 0 (el checkout es el que cede), pero sí que no quede a un scroll largo de distancia.
    */
    const checkoutRect = checkout.getBoundingClientRect();
    const pagoOffset = pago
      ? Math.max(0, Math.round(pago.getBoundingClientRect().top - checkoutRect.bottom))
      : null;

    return {
      zona: {
        top: Math.round(zonaRect.top),
        bottom: Math.round(zonaRect.bottom),
        client: zona.clientHeight,
        scroll: zona.scrollHeight,
      },
      filas,
      checkout: { client: checkout.clientHeight, scroll: checkout.scrollHeight },
      totalVisible: visible(document.querySelector('[data-testid="pos-sale-total"]')),
      pagoVisible: visible(pago),
      pagoOffset,
      cobrarVisible: visible(cobrar),
      cobrarBottom: cobrar ? Math.round(cobrar.getBoundingClientRect().bottom) : null,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      pageScroll: document.documentElement.scrollHeight - window.innerHeight,
      sheetAbierto: Boolean(panel.getBoundingClientRect().height),
    };
  });
}

/** Deja el mostrador limpio: la venta en curso vive en el dispositivo. */
async function abrirPosLimpio(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto("/admin/pos");
  await page.evaluate(() => {
    // Solo lo del POS: la sesión del panel no vive en `localStorage`.
    for (const clave of Object.keys(window.localStorage)) {
      if (clave.startsWith("one-burger-pos-")) window.localStorage.removeItem(clave);
    }
  });
  await page.goto("/admin/pos");
  await expect(page.getByRole("heading", { level: 1, name: "POS" })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(
    page.getByRole("button", { name: /^Agregar .* a la venta$/ }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("ticket de la venta rápida · geometría real", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  for (const viewport of DESKTOP) {
    test(`con 3 líneas, ${viewport.width}×${viewport.height}: líneas completas, sin scroll y con el CTA a la vista`, async ({
      page,
    }) => {
      await abrirPosLimpio(page, viewport);
      await agregarProductos(page, 3);

      const geo = await medirTicket(page);
      console.log(
        `TICKET ${viewport.width}x${viewport.height} zona=${geo.zona.client}/${geo.zona.scroll} checkout=${geo.checkout.client}/${geo.checkout.scroll} pagoOffset=${geo.pagoOffset} filas=${geo.filas.map((f) => (f.visibleEntera ? "ok" : "cortada")).join(",")}`,
      );

      // Las tres líneas, completas y de una: es el defecto que esta TASK corrige.
      expect(geo.filas).toHaveLength(3);
      expect(geo.filas.every((fila) => fila.visibleEntera)).toBe(true);

      // El scroll de la lista no aparece: la lista cabe en su zona.
      expect(geo.zona.scroll).toBeLessThanOrEqual(geo.zona.client);
      expect(geo.zona.scroll - geo.zona.client).toBeLessThanOrEqual(2);

      // Lo que la venta necesita para cerrarse, a la vista.
      expect(geo.totalVisible).toBe(true);
      expect(geo.cobrarVisible).toBe(true);

      /*
        Y la **forma de pago entra en el primer viewport del checkout**: el checkout puede scrollear por diseño
        (es el que cede), pero lo que la venta necesita para cerrarse no puede quedar debajo del pliegue.
        Medido: offset 0 tanto a `1366×768` como a `1280×720`.
      */
      expect(geo.pagoOffset).toBe(0);
      expect(geo.pagoVisible).toBe(true);

      // Sin scroll de página para cobrar y sin scroll horizontal.
      expect(geo.pageScroll).toBe(0);
      expect(geo.overflowX).toBe(0);
    });
  }

  test("con más líneas de las que entran, el scroll queda solo en la lista y el CTA no se mueve", async ({
    page,
  }) => {
    const viewport = { width: 1366, height: 768 };
    await abrirPosLimpio(page, viewport);

    /*
      Se usa la **carta entera**: la de local tiene 5 productos y uno de ellos pregunta modificadores, así que
      quedan 4 líneas posibles. Son suficientes para desbordar la zona de líneas (4 filas ≈ 250 px contra los
      240 px del tope) y es el caso real del mostrador: la venta crece y la lista tiene que scrollear sola.
    */
    const disponibles = await page.locator('[aria-label="Productos del local"] > li').count();
    expect(disponibles).toBeGreaterThanOrEqual(4);
    await agregarProductos(page, disponibles - 1);

    const geo = await medirTicket(page);

    // La lista scrollea: hay más filas que alto disponible.
    expect(geo.zona.scroll).toBeGreaterThan(geo.zona.client);
    // Pero las primeras filas siguen enteras: no se recorta una a medias.
    expect(geo.filas.filter((fila) => fila.visibleEntera).length).toBeGreaterThanOrEqual(3);
    // El CTA sigue firme al pie y la página no scrollea.
    expect(geo.cobrarVisible).toBe(true);
    expect(geo.pageScroll).toBe(0);
    expect(geo.overflowX).toBe(0);
  });

  for (const viewport of [TODOS[2], TODOS[3]]) {
    test(`abajo de lg (${viewport.width}×${viewport.height}) el patrón es barra + sheet`, async ({
      page,
    }) => {
      await abrirPosLimpio(page, viewport);
      await agregarProductos(page, 3);

      // En tablet y celular el ticket vive en el sheet: se abre desde la barra inferior.
      await page.getByRole("button", { name: /Ver venta/ }).click();
      await page.waitForTimeout(600);

      const geo = await medirTicket(page);

      expect(geo.sheetAbierto).toBe(true);
      expect(geo.filas.length).toBeGreaterThanOrEqual(1);
      expect(geo.filas.every((fila) => fila.visibleEntera)).toBe(true);
      expect(geo.cobrarVisible).toBe(true);
      expect(geo.overflowX).toBe(0);
    });
  }
});

/**
 * El POS cobra contra el servidor: sin mutaciones habilitadas no se toca nada. Este bloque existe para dejar
 * escrito que la cobertura de este archivo es de **geometría**, no de dinero.
 */
test("la cobertura de geometría no depende de mutaciones", () => {
  expect(typeof mutationsAllowed).toBe("boolean");
});
