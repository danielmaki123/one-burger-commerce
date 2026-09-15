import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { normalizeSearchText } from "@/shared/lib/normalize-search-text";
import { canQuickAddProduct } from "@/shared/lib/product-quick-add";

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "Admin1234!";
export const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ADMIN_EMAIL;
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ADMIN_PASSWORD;
export const mutationsAllowed = process.env.E2E_ALLOW_MUTATIONS === "true";

/**
 * Catálogo público, leído por API.
 *
 * Los specs de **solo lectura** no pueden depender del seed local: el catálogo real es el que el
 * owner carga en `/admin/menu` y el seed solo existe en la base de desarrollo. Resolviendo el
 * producto desde `/api/menu`, los mismos casos corren contra producción (QA) y en local.
 */
export type MenuProduct = {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number;
  packagingFeeAmount?: number | null;
  modifierGroups?: Array<{
    isRequired?: boolean | null;
    minSelections?: number | null;
    options?: Array<{ isActive?: boolean | null }> | null;
  }> | null;
};

export type MenuCategory = {
  id?: string;
  name?: string;
  slug?: string | null;
  products?: MenuProduct[] | null;
  subcategories?: { products?: MenuProduct[] | null }[] | null;
};

export type PublicMenu = {
  /** Productos de cada categoría, ya aplanados (subcategorías incluidas). */
  categories: Array<{ id: string; name: string; slug: string | null; products: MenuProduct[] }>;
  /** Todos los productos, en el orden en que los muestra el sitio. */
  products: MenuProduct[];
};

function categoryProducts(category: MenuCategory): MenuProduct[] {
  return [
    ...(category.products ?? []),
    ...(category.subcategories ?? []).flatMap((subcategory) => subcategory.products ?? []),
  ];
}

/**
 * El catálogo puede tener los productos en la categoría o en una subcategoría (el seed local usa
 * subcategorías; producción los tiene directos), así que se aplana antes de mirar.
 */
export function flattenMenuProducts(categories: MenuCategory[] | undefined): MenuProduct[] {
  return (categories ?? []).flatMap(categoryProducts);
}

export async function readPublicMenu(request: APIRequestContext): Promise<PublicMenu> {
  const payload = (await (await request.get("/api/menu")).json()) as {
    categories?: MenuCategory[];
  };

  const categories = (payload.categories ?? [])
    .map((category, index) => ({
      id: category.id ?? `category-${index}`,
      name: category.name ?? "",
      slug: category.slug ?? null,
      products: categoryProducts(category),
    }))
    .filter((category) => category.products.length > 0);

  return { categories, products: categories.flatMap((category) => category.products) };
}

/**
 * El slug de la categoría que contiene un producto, para poder abrir su riel (`/menu?category=`).
 *
 * El menú público dibuja **una categoría por vez** (la primera, o la que dice la URL), así que un
 * caso que busca el "+" de un producto tiene que entrar por la categoría donde vive: si no, el
 * resultado depende de en qué categoría quedó el producto y de cuántos populares muestra la home.
 */
export function findCategorySlugForProduct(
  categories: PublicMenu["categories"],
  productId: string,
): string | null {
  const category = categories.find((entry) =>
    entry.products.some((product) => product.id === productId),
  );

  return category?.slug ?? null;
}

/**
 * Producto que se puede pedir sin elegir nada: es el que dibuja el "+" en la grilla.
 *
 * La regla es **la de la app** (`canQuickAddProduct`), no una copia: si el catálogo cambia de
 * criterio, los specs lo siguen solos. Un grupo obligatorio o con mínimo de selecciones alcanza
 * para que la tarjeta lleve al detalle en vez de agregar.
 */
export function pickQuickAddProduct(products: MenuProduct[]): MenuProduct | undefined {
  return products.find((product) => canQuickAddProduct(product));
}

/** Producto con opciones obligatorias: su tarjeta lleva al detalle en vez de agregar. */
export function pickProductWithRequiredChoices(products: MenuProduct[]): MenuProduct | undefined {
  return products.find((product) => !canQuickAddProduct(product));
}

/**
 * Un producto cuyo nombre **no aparece** en ningún otro producto de la carta.
 *
 * Sirve para buscar sin ambigüedad: el buscador (menú y home) matchea contra `nombre +
 * descripción` con la normalización de la app, así que si el nombre elegido apareciera en la
 * descripción de otro producto, la búsqueda mostraría los dos y la aserción negativa mentiría.
 */
export function pickSearchableProduct(products: MenuProduct[]): MenuProduct | undefined {
  return products.find((product) => {
    const needle = normalizeSearchText(product.name);
    if (!needle) return false;

    const matches = products.filter((other) =>
      normalizeSearchText(`${other.name} ${other.description ?? ""}`).includes(needle),
    );

    return matches.length === 1 && matches[0].id === product.id;
  });
}

/** Deja un producto en el carrito sin tocar la API: el carrito del cliente vive en `localStorage`. */
export async function seedCartWithProduct(page: Page, product: MenuProduct): Promise<void> {
  await page.addInitScript(
    (item) => {
      localStorage.setItem("one-burger-cart", JSON.stringify([item]));
    },
    {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.basePrice,
      packagingUnitAmount: product.packagingFeeAmount ?? 0,
      packagingTotalAmount: product.packagingFeeAmount ?? 0,
      modifierOptionIds: [],
      modifiers: [],
      lineTotal: product.basePrice,
    },
  );
}

/**
 * Agrega al carrito, por la UI, el primer producto que se puede pedir sin elegir nada.
 *
 * Es para los specs de **solo lectura**: el carrito vive en `localStorage`, así que esto no toca la
 * API ni la base, y al resolver el producto desde el catálogo real el caso corre igual en local y
 * contra producción.
 */
export async function addCatalogProductToCart(
  page: Page,
  request: APIRequestContext,
): Promise<MenuProduct> {
  const product = pickQuickAddProduct((await readPublicMenu(request)).products);

  if (!product) {
    throw new Error("el catálogo no tiene ningún producto sin opciones obligatorias");
  }

  await page.goto(`/menu/${product.id}`);
  await page.getByRole("button", { name: /Agregar al carrito/ }).click();
  await expect(page.getByRole("status").getByText("Agregado al carrito")).toBeVisible();

  return product;
}

/**
 * Intenta entrar al panel con las credenciales del entorno y devuelve si lo logró.
 *
 * Los specs que necesitan el panel se **saltean** cuando las credenciales no sirven para ese entorno
 * (contra producción la contraseña la administra el owner y no está en el repo): mejor decir por qué
 * no se verificó que fallar por datos. Con `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` configurados, los
 * mismos casos corren en cualquier entorno.
 */
export async function tryLoginAsOwner(page: Page): Promise<boolean> {
  await page.goto("/admin/login");

  // Con una sesión activa, `/admin/login` redirige al panel: ya estamos adentro.
  if (/\/admin(?:\/orders)?$/.test(page.url())) return true;

  const email = page.locator('input[type="email"]');
  if ((await email.count()) === 0) return false;

  await email.fill(E2E_ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  return page
    .waitForURL(/\/admin(?:\/orders)?$/, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
}

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
