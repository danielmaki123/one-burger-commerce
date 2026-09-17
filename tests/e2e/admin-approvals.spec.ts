import { expect, test } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — la bandeja de aprobaciones, en un navegador real.
 *
 * El flujo completo (pedir una devolución → verla pendiente → aprobarla o rechazarla) se cubre con
 * tests unitarios de los casos de uso y de las rutas, porque necesita **dos** sesiones distintas: quien
 * pide no puede firmar la suya. Acá se verifica lo que solo se ve en el navegador: que la pantalla
 * exista para quien administra la caja, que diga el estado real y que no rompa a 375 px.
 */

test.describe("bandeja de aprobaciones", () => {
  test("dice el estado real de la cola y no rompe a 375 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsOwner(page);
    await page.goto("/admin/approvals");

    await expect(page.getByRole("heading", { name: "Aprobaciones" })).toBeVisible();
    // Con o sin pendientes, la pantalla dice qué hay: o la lista, o que no hay nada.
    const vacia = page.getByText("Nada pendiente de aprobación.");
    const lista = page.getByRole("list", { name: "Devoluciones pendientes" });
    await expect(vacia.or(lista)).toBeVisible();

    // Un 500 de Next muestra este texto: es la clase de falla que este spec vino a atrapar.
    await expect(page.getByText("A server error occurred")).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("a 1280 px la cola se ve en el panel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsOwner(page);
    await page.goto("/admin/approvals");

    await expect(page.getByRole("heading", { name: "Aprobaciones" })).toBeVisible();
    await expect(page.getByText("Nada pendiente de aprobación.").or(
      page.getByRole("list", { name: "Devoluciones pendientes" }),
    )).toBeVisible();
  });
});
