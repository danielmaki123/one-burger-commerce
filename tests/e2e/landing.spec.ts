import { expect, test } from "@playwright/test";

/**
 * Landing del dominio de marca.
 *
 * En producción el apex reescribe `/` a `/landing`; acá se prueba por su ruta
 * directa, que funciona en cualquier host (local incluido).
 */
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
});
