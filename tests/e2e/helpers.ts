import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "Admin1234!";
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ADMIN_EMAIL;
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ADMIN_PASSWORD;
export const mutationsAllowed = process.env.E2E_ALLOW_MUTATIONS === "true";

export async function loginAsOwner(page: Page) {
  await page.goto("/admin/login");
  await page.locator('input[type="email"]').fill(E2E_ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/orders)?$/);
}

/**
 * Drops the admin session. Needed before signing in with a different account:
 * `/admin/login` redirects to `/admin` while a session is still active.
 */
export async function logoutAdmin(page: Page) {
  await page.request.post("/api/auth/admin/logout");
  await page.goto("/admin/login");
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
}

/**
 * Creates an admin account from the users screen. It drives the real UI instead
 * of `page.request`, whose cookie jar does not carry the `Secure` session cookie
 * over plain http on local runs.
 */
export async function createAdminUserViaUi(
  page: Page,
  {
    name,
    email,
    password,
    role,
  }: { name: string; email: string; password: string; role: "owner" | "manager" | "kitchen" },
) {
  await page.goto("/admin/users");
  await page.getByLabel("Nombre").fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByLabel("Rol del nuevo usuario").selectOption(role);
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Usuario creado correctamente.")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
}

/**
 * Adds a seeded product through the real product screen. Injecting the cart in
 * localStorage races with the CartProvider bootstrap, so the spec drives the UI.
 */
export async function addSeedProductToCart(page: Page, productId = "seed-prod-01") {
  await page.goto(`/menu/${productId}`);
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await expect(
    page.getByRole("status").getByText("Agregado al carrito"),
  ).toBeVisible();
}
