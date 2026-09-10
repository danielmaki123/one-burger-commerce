import { expect, test } from "@playwright/test";

/**
 * Landing del dominio de marca.
 *
 * En producción el apex reescribe `/` a `/landing`; acá se prueba por su ruta
 * directa, que funciona en cualquier host (local incluido).
 */

/**
 * Camino real de producción: el apex reescribe la raíz al landing.
 *
 * El navegador resuelve el dominio de marca contra el server local, así que se
 * prueba la misma entrada que usa un cliente sin tocar DNS ni desplegar.
 * Se activa con:
 *   E2E_APEX_HOST=oneburgernic.com E2E_APEX_PORT=3210 npm run test:e2e
 */
const APEX_HOST = process.env.E2E_APEX_HOST;
const APEX_PORT = process.env.E2E_APEX_PORT ?? "3210";

test.use(
  APEX_HOST
    ? { launchOptions: { args: [`--host-resolver-rules=MAP ${APEX_HOST} 127.0.0.1`] } }
    : {},
);

test.describe("apex (reescritura de producción)", () => {
  test.skip(!APEX_HOST, "Se activa con E2E_APEX_HOST en el entorno local.");

  test("la raíz del dominio sirve el landing y el botón apunta al subdominio", async ({
    page,
  }) => {
    await page.goto(`http://${APEX_HOST}:${APEX_PORT}/`);

    await expect(page.locator("#landing-frame")).toBeVisible();
    await expect(page.getByRole("link", { name: "MENU" })).toHaveAttribute(
      "href",
      `https://menu.${APEX_HOST}`,
    );
    // Es un rewrite, no un redirect: la URL visible sigue siendo la raíz.
    expect(new URL(page.url()).pathname).toBe("/");
  });

  // Las redirecciones entre dominios no se prueban acá: el `request` de Playwright
  // no usa el resolvedor de hosts del navegador. Su lógica está cubierta en
  // `src/shared/config/host-routing.test.ts` y `src/proxy.test.ts`, y contra
  // producción real en `tests/e2e/production-hosts.spec.ts`.
});

test.describe("landing", () => {
  test("muestra la animación y el botón MENU", async ({ page }) => {
    await page.goto("/landing");

    const frame = page.locator("#landing-frame");
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("src", "/landing/frames/burger_0045.webp");

    // Sin el header ni el footer del sitio público: es pantalla completa.
    await expect(page.getByRole("link", { name: "One Burger inicio" })).toHaveCount(0);

    const menuButton = page.getByRole("link", { name: "MENU" });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("href", /\/menu$/);
  });

  test("los frames avanzan al hacer scroll", async ({ page }) => {
    await page.goto("/landing");

    const frame = page.locator("#landing-frame");
    const firstFrame = await frame.getAttribute("src");

    // El escenario mide 285vh: bajamos casi todo su recorrido.
    await page.evaluate(() => {
      const stage = document.getElementById("landing-stage");
      const scrollable = (stage?.getBoundingClientRect().height ?? 0) - window.innerHeight;
      window.scrollTo({ top: scrollable, behavior: "instant" });
    });

    await expect
      .poll(async () => frame.getAttribute("src"), {
        message: "el frame debería cambiar al scrollear",
      })
      .not.toBe(firstFrame);

    await expect(frame).toHaveAttribute("src", "/landing/frames/burger_0120.webp");
  });

  test("con movimiento reducido deja un frame fijo", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/landing");

    const frame = page.locator("#landing-frame");
    const firstFrame = await frame.getAttribute("src");

    await page.evaluate(() => {
      const stage = document.getElementById("landing-stage");
      const scrollable = (stage?.getBoundingClientRect().height ?? 0) - window.innerHeight;
      window.scrollTo({ top: scrollable, behavior: "instant" });
    });

    await page.waitForTimeout(600);
    expect(await frame.getAttribute("src")).toBe(firstFrame);
  });

  test("todos los frames de la secuencia están publicados", async ({ request }) => {
    // Si un frame faltara, el scrubbing mostraría un hueco.
    const frames = [
      "burger_0045",
      "burger_0069",
      "burger_0080",
      "burger_0083",
      "burger_0113",
      "burger_0120",
    ];

    for (const name of frames) {
      const response = await request.get(`/landing/frames/${name}.webp`);
      expect(response.status(), `${name} debería estar publicado`).toBe(200);
    }
  });

  test("en 375 px entra todo y no hay scroll horizontal", async ({ page }) => {
    // El repo exige verificar la UI a 375 px: es el ancho de referencia.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/landing");

    const button = page.getByRole("link", { name: "MENU" });
    await expect(button).toBeVisible();

    const buttonBox = await button.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox!.x).toBeGreaterThanOrEqual(0);
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(375);
    // Control táctil: nunca menos de 44 px de alto.
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44);

    const frameBox = await page.locator("#landing-frame").boundingBox();
    expect(frameBox!.width).toBeLessThanOrEqual(375);

    // El escenario móvil es más corto (255vh): si no, el scroll se hace eterno.
    const stageHeight = await page
      .locator("#landing-stage")
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(stageHeight).toBeLessThan(812 * 2.7);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
