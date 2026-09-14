import { expect, test, type Page } from "@playwright/test";

import { tryLoginAsOwner } from "./helpers";

/**
 * CSP con nonce (endurecimiento).
 *
 * El proyecto no tenía ninguna política: un `<script>` inyectado corría igual. La
 * política se arma en el proxy con un nonce por respuesta. Este test la verifica donde
 * importa: en un navegador real, sobre las pantallas reales, escuchando las violaciones
 * que el navegador reporta y comprobando que la app **sigue hidratando** (un nonce mal
 * puesto no rompe el HTML, rompe el JavaScript, y eso se ve en la interacción).
 */
async function openCollectingViolations(page: Page, path: string) {
  const violations: string[] = [];

  const onConsole = (message: { text: () => string }) => {
    const text = message.text();
    if (/content security policy|refused to (load|execute|connect|apply)/i.test(text)) {
      violations.push(`${path}: ${text}`);
    }
  };

  page.on("console", onConsole);
  const response = await page.goto(path);

  return { violations, response };
}

test.describe("CSP del sitio", () => {
  test("cada pantalla trae la politica con un nonce propio, sin violaciones", async ({ page }) => {
    const paths = ["/", "/menu", "/cart", "/checkout", "/landing", "/admin/login"];

    for (const path of paths) {
      const { violations, response } = await openCollectingViolations(page, path);
      const policy = response?.headers()["content-security-policy"] ?? "";

      expect(policy, `falta la CSP en ${path}`).toContain("default-src 'self'");
      expect(policy, `falta el nonce en ${path}`).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
      expect(policy, `falta object-src en ${path}`).toContain("object-src 'none'");

      // Si Next no aplicara el nonce a sus scripts, acá habría violaciones.
      expect(violations).toEqual([]);
    }
  });

  test("el admin sigue funcionando con la politica puesta", async ({ page }) => {
    test.skip(
      !(await tryLoginAsOwner(page)),
      "hacen falta credenciales del admin del entorno (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)",
    );

    const violations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/content security policy|refused to (load|execute|connect|apply)/i.test(text)) {
        violations.push(text);
      }
    });

    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Comandas" }).first()).toBeVisible();

    expect(violations).toEqual([]);
  });

  test("la hidratacion sigue viva: el '+' del menu agrega de verdad", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/content security policy|refused to (load|execute|connect|apply)/i.test(text)) {
        violations.push(text);
      }
    });

    await page.goto("/menu");
    const quickAdd = page.getByRole("button", { name: /Agregar .* al carrito/ }).first();
    await quickAdd.click();

    await expect(page.getByRole("status").getByText("Agregado al carrito")).toBeVisible();
    expect(violations).toEqual([]);
  });
});
