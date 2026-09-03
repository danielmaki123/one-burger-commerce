export type AdminSubcategory = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  productCount?: number;
};

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  subcategories: AdminSubcategory[];
};

export type CategoryAttentionItem = {
  categoryId: string;
  title: string;
  detail: string;
};

// R4: pluralización en español real, nunca "subcategoría(s)".
export function pluralEs(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

export function countCategoryProducts(category: AdminCategory): number {
  return category.subcategories.reduce(
    (sum, subcategory) => sum + (subcategory.productCount ?? 0),
    0,
  );
}

// Tira "Necesita atención" de Categorías: solo problemas reales y accionables.
// - Categoría activa sin subcategorías: sus platos se muestran sueltos.
// - Categoría activa con subcategorías pero sin platos: se ve vacía en la carta.
export function findCategoryAttention(
  categories: AdminCategory[],
): CategoryAttentionItem[] {
  const items: CategoryAttentionItem[] = [];

  for (const category of categories) {
    if (!category.isActive) continue;

    if (category.subcategories.length === 0) {
      const products = countCategoryProducts(category);
      items.push({
        categoryId: category.id,
        title: `“${category.name}” no tiene subcategorías`,
        detail:
          products > 0
            ? `${pluralEs(products, "plato suelto", "platos sueltos")} en la carta`
            : "Sin subcategorías para ordenar la carta",
      });
      continue;
    }

    const activeSubcategories = category.subcategories.filter(
      (subcategory) => subcategory.isActive,
    );
    if (activeSubcategories.length > 0 && countCategoryProducts(category) === 0) {
      items.push({
        categoryId: category.id,
        title: `“${category.name}” se ve vacía`,
        detail: "No tiene platos asignados en sus subcategorías",
      });
    }
  }

  return items;
}
