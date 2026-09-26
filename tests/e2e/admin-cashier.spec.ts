import { expect, test } from "@playwright/test";

import { loginAsCashier, mutationsAllowed } from "./helpers";

/**
 * Tarea 7.3 del roadmap + decisión del owner (2026-09-17) — **el cajero**, en un navegador real.
 *
 * El rol existía en el dominio y en el selector de Usuarios, pero no había forma de probarlo de punta a
 * punta: los specs solo entraban como dueño (o como cocina, para comprobar el rechazo). Este caso fija lo
 * que separa al cajero: **cobra y administra su caja** (`canUsePOS`) y **no audita** el dinero
 * (`canViewCashHistory`): no ve el historial de cierres, ni el reporte del día, ni las aprobaciones de
 * devoluciones. Si mañana alguien le abre una de esas puertas, este spec se pone rojo.
 */

test.describe("el cajero", () => {
  test("cobra y administra su caja, pero no audita el dinero", async ({ page }) => {
    test.skip(!mutationsAllowed, "Crear un usuario toca la base: E2E_ALLOW_MUTATIONS=true.");

    await loginAsCashier(page, {
      name: "Cajero E2E",
      email: `cajero-${Date.now()}@example.com`,
      password: "Cajero1234!",
    });

    // 1. Su trabajo: la caja del mostrador. Puede abrir y cerrar el turno.
    await page.goto("/admin/cash");
    await expect(page.getByRole("region", { name: "Caja del local" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(Abrir|Cerrar) caja$/ }),
    ).toBeVisible();

    // 2. Lo que NO es suyo: la mitad de auditoría vive fuera de su pantalla, así que lo que se comprueba
    //    es la **puerta** (la sección Cierres lo redirige) y no la ausencia de un bloque, que desde la
    //    Fase 1b del rediseño de Caja ya no está para nadie.
    await expect(page.getByRole("link", { name: "Reporte del día" })).toHaveCount(0);

    // 2b. A-40 (Fase 1a del rediseño de Caja): tampoco el enlace al detalle del turno — el detalle lo
    //     redirige a Órdenes, así que ofrecerlo era un enlace que rebota. La aserción solo tiene dientes
    //     con una caja abierta (el arnés local la deja abierta): con la caja cerrada el bloque del turno
    //     no se dibuja y pasa por ausencia.
    await expect(page.getByRole("link", { name: "Ver el turno abierto" })).toHaveCount(0);

    // 3. Y tampoco el historial de cierres, el reporte del día ni las aprobaciones: la pantalla lo manda
    //    a sus órdenes.
    await page.goto("/admin/history/cierres");
    await expect(page).toHaveURL(/\/admin\/orders$/);

    await page.goto("/admin/cash/report");
    await expect(page).toHaveURL(/\/admin\/orders$/);

    await page.goto("/admin/approvals");
    await expect(page).toHaveURL(/\/admin\/orders$/);

    // 4. El mostrador: cobra y **no descuenta a mano** (tarea 9.7). Un descuento manual es plata que el
    //    cliente deja de pagar porque alguien lo decidió, y lo autoriza quien administra la caja.
    //
    //    La Fase 1 (`SCREEN-POS-QUICK-SALE-001`): la venta es un panel de dos columnas y las opciones
    //    secundarias viven detrás de su disparador. El cajero **no tiene** el descuento manual: el
    //    disparador no existe para él y el formulario tampoco.
    await page.goto("/admin/pos");
    await expect(page.getByRole("dialog", { name: "Venta en curso" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aplicar descuento" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Descuento manual" })).toHaveCount(0);

    await page.getByRole("button", { name: "Aplicar promo" }).click();
    await expect(page.getByLabel("Código de promo (opcional)")).toBeVisible();
  });
});
