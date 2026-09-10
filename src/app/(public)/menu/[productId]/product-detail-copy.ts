import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";

type ProductSummary = {
  id: string;
  name: string;
};

type PublicCategory = {
  id: string;
  name: string;
  products?: ProductSummary[];
  subcategories?: Array<{
    id: string;
    name: string;
    products?: ProductSummary[];
  }>;
};

export type ProductWithContext<TProduct extends ProductSummary = ProductSummary> = TProduct & {
  categoryName?: string;
  subcategoryName?: string;
};

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

export function findPublicProductById<TProduct extends ProductSummary>(
  categories: PublicCategory[],
  productId: string,
): ProductWithContext<TProduct> | null {
  for (const category of categories) {
    const topLevelProduct = (category.products ?? []).find((product) => product.id === productId);
    if (topLevelProduct) {
      return {
        ...(topLevelProduct as TProduct),
        categoryName: category.name,
      };
    }

    for (const subcategory of category.subcategories ?? []) {
      const subcategoryProduct = (subcategory.products ?? []).find(
        (product) => product.id === productId,
      );
      if (subcategoryProduct) {
        return {
          ...(subcategoryProduct as TProduct),
          categoryName: category.name,
          subcategoryName: subcategory.name,
        };
      }
    }
  }

  return null;
}

export function getProductDetailEyebrow(product: {
  categoryName?: string | null;
  subcategoryName?: string | null;
} | null): string {
  const typeLabel = product?.subcategoryName?.trim() || product?.categoryName?.trim() || "";
  const normalized = normalizeLabel(typeLabel);

  if (normalized === "cocteles") {
    return "Cóctel de la casa";
  }

  return typeLabel || "Detalle del producto";
}

export function formatModifierOptionPrice(
  priceDelta: number,
  format: CurrencyFormat,
): string {
  if (priceDelta > 0) {
    return `+${formatCurrency(priceDelta, format)}`;
  }

  return formatCurrency(0, format);
}
