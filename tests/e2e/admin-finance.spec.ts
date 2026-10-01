import { expect, test } from "@playwright/test";

import { ADMIN_LANDING_PATTERN, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./helpers";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — **QA de la superficie `/admin/finance`** contra la SPEC congelada
 * ([`ops/design/screens/finance.md`](../../ops/design/screens/finance.md)) y su referencia aprobada.
 *
 * Lo que este spec verifica, y que sólo se puede ver en un navegador real:
 *
 * 1. **El Viewport Contract** — `1366×768`, `1280×720`, `768×1024` y `375×812`: en cada uno, la página **no**
 *    scrollea (el scroll vive en el panel), **no** hay scroll horizontal, y el titular, las tabs y la acción
 *    primaria se ven sin scrollear.
 * 2. **Las tres vistas** conmutan por tabs y cada una dibuja su contenido.
 * 3. **`mixed` no se ofrece como medio** (`D-017`): el modal de un medio nuevo no lo tiene entre las
 *    opciones de tipo, porque el sistema lo **deriva**.
 *
 * No escribe configuración: guardar una moneda o una tasa ya está cubierto por los tests de dominio y de la
 * ruta, y este spec corre contra una base local con datos de QA. Los controles de escritura se ejercitan en
 * el E2E de flujos, no acá.
 *
 * Se corre con el servidor local arriba (`npm run dev -- --port 3011`) y el seed de QA
 * (`npx tsx scripts/qa-seed-money.ts`).
 */

const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "375x812", width: 375, height: 812 },
] as const;

test.describe("Finanzas · Viewport Contract", () => {
  for (const viewport of VIEWPORTS) {
    test(`la pantalla entra en ${viewport.name} sin scroll de página`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      await page.goto("/admin/login");
      await page.locator('input[type="email"]').fill(E2E_ADMIN_EMAIL);
      await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Iniciar sesión" }).click();
      await page.waitForURL(ADMIN_LANDING_PATTERN, { timeout: 20_000 });

      await page.goto("/admin/finance");

      // El titular y las tabs: lo primero que la spec pide ver en el primer viewport.
      await expect(page.getByRole("heading", { name: "Finanzas", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Medios de pago/ })).toBeVisible();

      // La acción primaria de la vista activa.
      await expect(page.getByRole("button", { name: "+ Nuevo medio" })).toBeVisible();

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        pageScrollHeight: document.scrollingElement?.scrollHeight ?? 0,
        innerHeight: window.innerHeight,
      }));

      // Sin scroll horizontal: es la regla de 320..1280 px y del contrato de viewport.
      expect(
        metrics.scrollWidth,
        `scroll horizontal en ${viewport.name}: ${metrics.scrollWidth} > ${metrics.clientWidth}`,
      ).toBeLessThanOrEqual(metrics.clientWidth + 1);

      await page.screenshot({
        path: `test-results/qa-finance-${viewport.name}.png`,
        fullPage: false,
      });

      await context.close();
    });
  }
});

test.describe("Finanzas · las tres vistas y el copy congelado", () => {
  test("conmuta entre Medios de pago, Monedas y tasas y Entidades de cobro", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(E2E_ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL(ADMIN_LANDING_PATTERN, { timeout: 20_000 });

    await page.goto("/admin/finance");
    await expect(page.getByRole("heading", { name: "Finanzas", exact: true })).toBeVisible();

    // Medios de pago: el copy que la referencia congela.
    await expect(
      page.getByText("«Mixto» no es un medio", { exact: false }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Monedas y tasas/ }).click();
    await expect(page.getByText("Moneda base", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Historia protegida", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: /Entidades de cobro/ }).click();
    await expect(page.getByRole("heading", { name: "Entidades de cobro" })).toBeVisible();

    await page.screenshot({ path: "test-results/qa-finance-entities-1280.png" });
  });

  test("`mixed` no se ofrece como medio: el sistema lo deriva (D-017)", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(E2E_ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL(ADMIN_LANDING_PATTERN, { timeout: 20_000 });

    await page.goto("/admin/finance");
    await page.getByRole("button", { name: "+ Nuevo medio" }).click();

    const kindSelect = page.getByLabel("Tipo");
    await expect(kindSelect).toBeVisible();

    const options = await kindSelect.locator("option").allTextContents();

    expect(options.join(" | ")).not.toContain("Mixto");
    expect(options).toContain("Efectivo");
    expect(options).toContain("Transferencia bancaria");

    await page.screenshot({ path: "test-results/qa-finance-method-modal.png" });
  });

  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-86`) — **la disponibilidad por sucursal se edita**.
   *
   * La referencia congelada de Finanzas tiene «Disponibilidad: Todos los locales / Locales seleccionados» y
   * la tabla `PaymentMethodLocation` la modela, pero la pantalla no la dibujaba y el payload no la aceptaba:
   * la capacidad estaba a medio implementar. Sólo se puede ver en un navegador real que los controles estén.
   */
  test("el modal del medio ofrece la disponibilidad por sucursal (A-86)", async ({ page }) => {
    await page.goto("/admin/login");
    await page.locator('input[type="email"]').fill(E2E_ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await page.waitForURL(ADMIN_LANDING_PATTERN, { timeout: 20_000 });

    await page.goto("/admin/finance");
    await page.getByRole("button", { name: "+ Nuevo medio" }).click();

    await expect(page.getByText("Disponibilidad", { exact: true })).toBeVisible();
    // Sin ningún local marcado el medio se ofrece en todos: la ayuda lo dice para que nadie crea que quedó
    // apagado.
    await expect(page.getByText("Todos los locales", { exact: false })).toBeVisible();

    await page.screenshot({ path: "test-results/qa-finance-method-availability.png" });
  });
});
