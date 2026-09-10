import { expect, test, type APIResponse } from "@playwright/test";

/**
 * Verificación de los tres dominios de producción.
 *
 * Es **solo lectura**: no escribe nada. Se salta sola salvo que `BASE_URL` sea el
 * dominio público de marca, así que la suite local (127.0.0.1) no la ejecuta y no
 * depende de que los subdominios existan.
 *
 * Uso:
 *   BASE_URL=https://oneburgernic.com npm run test:e2e:prod:hosts
 */

const BASE_URL = process.env.BASE_URL ?? "";
const MENU_APP_URL = process.env.MENU_APP_URL;
const ADMIN_APP_URL = process.env.ADMIN_APP_URL;

function resolveApex(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname === "localhost" || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
    if (hostname.endsWith(".easypanel.host")) return null;

    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * `Location` puede venir relativo (`/admin`) o absoluto según quién redirija:
 * se normaliza antes de comparar.
 */
function resolvedLocation(response: APIResponse, requestUrl: string): string {
  const location = response.headers()["location"] ?? "";

  try {
    const resolved = new URL(location, requestUrl).toString();
    return resolved.length > 1 ? resolved.replace(/\/$/, "") : resolved;
  } catch {
    return location;
  }
}

const apex = resolveApex(BASE_URL);
const menuBase = MENU_APP_URL ?? (apex ? `https://menu.${apex}` : null);
const adminBase = ADMIN_APP_URL ?? (apex ? `https://admin.${apex}` : null);

test.describe("dominios de producción", () => {
  test.skip(
    !apex || !menuBase || !adminBase,
    "Sólo corre contra el dominio público de marca (BASE_URL=https://<dominio>).",
  );

  test("el apex sirve el landing", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#landing-frame")).toBeVisible();
    await expect(page.getByRole("link", { name: "MENU" })).toHaveAttribute(
      "href",
      menuBase!,
    );
    // El landing no arrastra el header del sitio público.
    await expect(page.getByRole("link", { name: "One Burger inicio" })).toHaveCount(0);
  });

  test("el apex redirige las páginas del sitio a la app de pedidos", async ({ request }) => {
    for (const path of ["/menu", "/cart", "/checkout"]) {
      const response = await request.get(`${BASE_URL}${path}`, { maxRedirects: 0 });

      expect(response.status(), `${path} debería redirigir`).toBe(307);
      expect(resolvedLocation(response, `${BASE_URL}${path}`)).toBe(`${menuBase}${path}`);
    }
  });

  test("el apex redirige el admin al host del panel", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/admin`, { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(resolvedLocation(response, `${BASE_URL}/admin`)).toBe(`${adminBase}/admin`);
  });

  test("la app de pedidos responde en su subdominio y manda el admin al panel", async ({
    request,
  }) => {
    const menu = await request.get(`${menuBase}/menu`, { maxRedirects: 0 });
    expect(menu.status()).toBe(200);

    const adminPath = await request.get(`${menuBase}/admin`, { maxRedirects: 0 });
    expect(adminPath.status()).toBe(307);
    expect(resolvedLocation(adminPath, `${menuBase}/admin`)).toBe(`${adminBase}/admin`);
  });

  test("el host del panel solo sirve el panel", async ({ request }) => {
    const root = await request.get(`${adminBase}/`, { maxRedirects: 0 });
    expect(root.status()).toBe(307);
    expect(resolvedLocation(root, `${adminBase}/`)).toBe(`${adminBase}/admin`);

    const login = await request.get(`${adminBase}/admin/login`, { maxRedirects: 0 });
    expect(login.status()).toBe(200);

    const stray = await request.get(`${adminBase}/checkout`, { maxRedirects: 0 });
    expect(stray.status()).toBe(307);
    expect(resolvedLocation(stray, `${adminBase}/checkout`)).toBe(`${menuBase}/checkout`);
  });

  test("los frames del landing se sirven desde el apex, sin redirigir", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/landing/frames/burger_0045.webp`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/webp");
  });
});
