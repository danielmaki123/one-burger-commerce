import { expect, test } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * Bloque 1 del roadmap del POS (Fase 2) — Caja del día y el detalle de un cierre.
 *
 * Estos dos casos existen por un motivo concreto: la pantalla de detalle es un **server component**
 * que muestra datos guardados, y esa clase de página puede compilar sin errores y fallar en runtime
 * (pasó en este mismo bloque: un `onChange` que cruzaba al cliente hacía 500 al abrir el detalle, y ni
 * `next build` ni `build:webpack` lo detectan). Un navegador real abriendo la URL es la única
 * verificación que lo cubre.
 */

/** Un id de turno del primer local con caja, por API (no se asume cuántos turnos hay). */
async function firstShiftId(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate(async () => {
    const locationsResponse = await fetch("/api/admin/locations", { cache: "no-store" });
    const locationsPayload = await locationsResponse.json();
    const locations = locationsPayload.data ?? [];

    for (const location of locations) {
      const shiftsResponse = await fetch(
        `/api/admin/cash/shifts?locationId=${encodeURIComponent(location.id)}`,
        { cache: "no-store" },
      );
      const shiftsPayload = await shiftsResponse.json();

      if (shiftsPayload.data?.length) return shiftsPayload.data[0].id;
    }

    return null;
  });
}

test.describe("caja del día", () => {
  test("el historial lista los turnos y no tiene scroll horizontal a 375 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsOwner(page);
    await page.goto("/admin/cash");

    await expect(page.getByRole("heading", { name: "Caja del día" })).toBeVisible();
    await expect(page.getByText(/Leyendo el historial de caja…/)).toBeHidden({ timeout: 20_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("el detalle de un cierre se abre con su arqueo y su conteo", async ({ page }) => {
    await loginAsOwner(page);
    const shiftId = await firstShiftId(page);
    expect(shiftId, "la base local tiene al menos un turno").toBeTruthy();

    await page.goto(`/admin/cash/history/${shiftId}`);

    await expect(page.getByRole("region", { name: "Arqueo del cierre" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Conteo por moneda" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Esperado por moneda" })).toBeVisible();
    // Un 500 de Next muestra este texto: es el caso que este spec vino a atrapar.
    await expect(page.getByText("A server error occurred")).toHaveCount(0);
  });
});
