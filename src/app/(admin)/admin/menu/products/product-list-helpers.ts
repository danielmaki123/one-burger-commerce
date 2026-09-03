export type AdminProduct = {
  id: string;
  name: string;
  basePrice: number;
  description: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  availability: {
    isAvailable: boolean;
    isActive: boolean;
  };
  images: { url: string; isPrimary: boolean }[];
};

export type AdminProductCategory = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export type ProductFilterState = {
  category: string;
  status: "active" | "inactive" | "all";
  availability: "all" | "available" | "unavailable";
};

export type ProductQuickPatch = {
  basePrice?: number;
  availability?: {
    isAvailable: boolean;
    isActive: boolean;
  };
};

export type ProductRequest = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export function countActiveProductFilters(filters: ProductFilterState) {
  return (
    Number(filters.category !== "all") +
    Number(filters.status !== "active") +
    Number(filters.availability !== "all")
  );
}

export type ProductCategoryCounts = {
  byCategory: Map<string, number>;
  uncategorized: number;
  total: number;
};

// Conteos faceted para los chips de categoría: se calculan sobre el conjunto
// ya filtrado por búsqueda y estado, nunca sobre el catálogo completo.
export function countProductsByCategory(
  products: AdminProduct[],
  knownCategoryIds: ReadonlySet<string>,
): ProductCategoryCounts {
  const byCategory = new Map<string, number>();
  let uncategorized = 0;
  for (const product of products) {
    if (product.categoryId && knownCategoryIds.has(product.categoryId)) {
      byCategory.set(product.categoryId, (byCategory.get(product.categoryId) ?? 0) + 1);
    } else {
      uncategorized += 1;
    }
  }
  return { byCategory, uncategorized, total: products.length };
}

export function parseProductPriceInput(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export async function patchAdminProduct(
  id: string,
  payload: ProductQuickPatch,
  request: ProductRequest = (input, init) => fetch(input, init),
): Promise<AdminProduct> {
  const response = await request(`/api/admin/menu/products/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as
    | { data?: AdminProduct; error?: { message?: string } }
    | null;

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    }
    if (response.status === 403) {
      throw new Error("Tu rol no permite modificar productos.");
    }
    throw new Error(body?.error?.message ?? "No se pudo actualizar el producto.");
  }

  if (!body?.data) {
    throw new Error("La actualización no devolvió el producto confirmado.");
  }

  return body.data;
}
