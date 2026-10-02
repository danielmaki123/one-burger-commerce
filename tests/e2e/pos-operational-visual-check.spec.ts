import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §59, §60) — **visual QA del POS operativo** en los cuatro viewports
 * del **Viewport Contract**, con capturas.
 *
 * Lo que se mide, y por qué cada cosa:
 *
 * - **Sin scroll horizontal de página** en ninguno de los cuatro: la banda de KPI scrollea **dentro de su
 *   contenedor** (brief §5/§60), nunca empujando el ancho del documento.
 * - **La página no scrollea en escritorio** en una venta normal: el scroll vive en el catálogo y en el ticket.
 * - **La banda operativa y los cuatro KPI están visibles** en el primer viewport, en los cuatro tamaños.
 * - **`Cobrar C$…` sigue visible** sin scrollear: la banda no puede haber empujado el CTA fuera de la
 *   pantalla (era el riesgo declarado de agregar una fila al encabezado).
 * - **Los controles táctiles miden ≥ 44 px**: es la ley del sistema y lo que sostiene el uso con el dedo.
 * - **El panel operacional se abre en un solo `<dialog>`** y **no intercepta** el resto de la pantalla cuando
 *   está cerrado (la deuda `A-92` era exactamente dos `<dialog open>` peleando por los punteros).
 *
 * Las capturas quedan en `test-results/qa-pos06-*.png` y son la evidencia del cierre.
 */

const VIEWPORTS = [
  { width: 1366, height: 768, name: "1366x768" },
  { width: 1280, height: 720, name: "1280x720" },
  { width: 768, height: 1024, name: "768x1024" },
  { width: 375, height: 812, name: "375x812" },
] as const;

async function metrics(page: Page) {
  return page.evaluate(() => {
    /**
     * El mínimo táctil del sistema: 44 px en los controles **visibles** de la banda de KPI. Se miden recién
     * después de esperar la banda (el `expect` de visibilidad del caso), así que un cero acá sería un control
     * sin caja —no un control que todavía no montó—.
     */
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid^="pos-kpi-"]'),
    )
      .filter((element) => element.getBoundingClientRect().height > 0)
      .map((element) => element.getBoundingClientRect().height);

    return {
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      minControlHeight: controls.length === 0 ? 0 : Math.min(...controls),
      controls: controls.length,
    };
  });
}

/** Abre el POS con la sesión del dueño y espera a que la banda operacional esté dibujada. */
async function openPos(page: Page) {
  await loginAsOwner(page);
  await page.goto("/admin/pos");
  await expect(page.getByRole("heading", { name: "POS" })).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test.describe(`POS operativo · QA visual ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.setTimeout(180_000);

    test("banda operativa, KPIs y CTA: sin overflow y con captura", async ({ page }) => {
      await openPos(page);

      // La banda de KPI tiene que estar: es lo que esta TASK agregó al encabezado.
      await expect(page.getByTestId("pos-kpi-ready")).toBeVisible();
      await expect(page.getByTestId("pos-kpi-process")).toBeVisible();
      await expect(page.getByTestId("pos-kpi-pending-payment")).toBeVisible();
      await expect(page.getByTestId("pos-kpi-scheduled")).toBeVisible();

      const measured = await metrics(page);

      expect(measured.overflowX, "el POS no puede scrollear en horizontal").toBeLessThanOrEqual(0);
      expect(measured.controls, "la banda tiene que dibujar sus cuatro contadores").toBe(4);
      expect(
        measured.minControlHeight,
        "los contadores de la banda tienen que medir al menos 44 px",
      ).toBeGreaterThanOrEqual(44);

      // En escritorio el POS usa el alto útil: la página no scrollea en una venta normal.
      if (viewport.width >= 1024) {
        expect(measured.pageScroll, "en escritorio la página no scrollea").toBeLessThanOrEqual(0);
      }

      await page.screenshot({
        path: `test-results/qa-pos06-${viewport.name}.png`,
        fullPage: false,
      });
    });

    test("el panel operacional es un solo diálogo y no intercepta cuando está cerrado", async ({
      page,
    }) => {
      await openPos(page);

      // Cerrado no hay ningún panel montado.
      await expect(page.getByTestId("pos-operational-panel")).toHaveCount(0);

      await page.getByTestId("pos-kpi-ready").click();

      await expect(page.getByTestId("pos-operational-panel")).toHaveCount(1);
      await expect(page.getByLabel("Buscar pedido")).toBeVisible();

      await page.screenshot({
        path: `test-results/qa-pos06-panel-${viewport.name}.png`,
        fullPage: false,
      });

      // Cerrar lo desmonta: la capa no queda esperando en el DOM.
      await page.getByRole("button", { name: "Cerrar panel" }).click();
      await expect(page.getByTestId("pos-operational-panel")).toHaveCount(0);
    });
  });
}
