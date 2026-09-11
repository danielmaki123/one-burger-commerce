import { normalizeSearchText } from "@/shared/lib/normalize-search-text";

type CategoryLike = {
  id: string;
  slug: string;
};

type MarketingBlockLike = {
  id: string;
};

type ProductModifierGroupLike = {
  options?: unknown[] | null;
};

type ProductCardCopyLike = {
  name: string;
  modifierGroups?: ProductModifierGroupLike[] | null;
};

type SearchableMenuProduct = {
  id: string;
  name: string;
  description: string | null;
};

type SearchableMenuCategory<TProduct extends SearchableMenuProduct> = {
  products: TProduct[];
  subcategories?: { products: TProduct[] }[];
};

export const publicMenuDensityClasses = {
  pageShell: "mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3 md:gap-6 md:px-6 md:py-5",
  marketingSection: "space-y-3",
  marketingScroller: "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  marketingCard: "group relative min-w-[78%] snap-center overflow-hidden rounded-[22px] border border-stone-200/70 bg-stone-950 text-stone-50 shadow-[0_10px_24px_rgba(28,25,23,0.14)] sm:min-w-[24rem] lg:min-w-[28rem]",
  marketingCardBody: "relative flex min-h-[9.5rem] flex-col justify-end gap-2.5 p-4 md:min-h-[13.5rem] md:p-5",
  marketingTitle: "line-clamp-2 max-w-lg text-xl font-semibold leading-tight text-white md:text-3xl",
  marketingDescription: "line-clamp-1 max-w-lg text-xs leading-5 text-stone-100/84 sm:line-clamp-2 md:text-sm",
  fallbackHero: "overflow-hidden rounded-[24px] border border-border bg-card px-4 py-4 shadow-[0_10px_24px_rgba(60,40,20,0.06)] md:px-6 md:py-6",
  stickyCategories: "sticky top-12 z-40 -mx-1 rounded-[20px] border border-border bg-background/92 px-2 py-2 shadow-[0_8px_22px_rgba(60,40,20,0.05)] backdrop-blur-md md:top-16",
  categoryRail: "flex snap-x snap-proximity gap-2 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:pr-0",
  categoryChip: "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition",
  contentStack: "space-y-8",
  productGrid: "grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3",
  productRailItem: "min-w-0",
} as const;

export function getInitialCategoryId(
  categories: CategoryLike[],
  categorySlug: string | null,
): string | null {
  if (categories.length === 0) return null;
  if (!categorySlug) return categories[0].id;

  const matched = categories.find((category) => category.slug === categorySlug);
  return matched?.id ?? categories[0].id;
}

export function hasActiveMarketingBlocks(
  blocks: MarketingBlockLike[] | null | undefined,
): boolean {
  return Array.isArray(blocks) && blocks.length > 0;
}

type ThumbnailProduct = {
  images?: { url: string }[] | null;
  availability?: { isAvailable: boolean; isActive: boolean } | null;
};

type ThumbnailCategory = {
  products?: ThumbnailProduct[] | null;
  subcategories?: { products?: ThumbnailProduct[] | null }[] | null;
};

/**
 * Foto de la categoría para el riel (T3).
 *
 * El mock le pone una imagen a cada categoría; en nuestro modelo la categoría no
 * tiene foto propia, así que se usa la del primer producto que se puede pedir. Si
 * no hay ninguna, el riel muestra solo el nombre: no se inventa un espacio vacío.
 */
export function getCategoryThumbnailUrl(category: ThumbnailCategory): string | null {
  const products = [
    ...(category.products ?? []),
    ...(category.subcategories ?? []).flatMap((subcategory) => subcategory.products ?? []),
  ];

  for (const product of products) {
    if (product.availability && !(product.availability.isActive && product.availability.isAvailable)) {
      continue;
    }

    const url = product.images?.[0]?.url;
    if (url) return url;
  }

  return null;
}

export function getMenuProductActionCopy(product: ProductCardCopyLike) {
  return {
    symbol: "+",
    ariaLabel: `Ver ${product.name}`,
  };
}

export function getMenuHeaderCountLabel({
  categoryCount,
  isSearching,
  searchResultCount,
}: {
  categoryCount: number;
  isSearching: boolean;
  searchResultCount: number;
}) {
  if (isSearching) {
    return searchResultCount === 1 ? "1 resultado" : `${searchResultCount} resultados`;
  }

  return categoryCount === 1 ? "1 categoría" : `${categoryCount} categorías`;
}

export function searchPublicMenuProducts<TProduct extends SearchableMenuProduct>(
  categories: SearchableMenuCategory<TProduct>[],
  rawQuery: string,
) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  const seenProductIds = new Set<string>();
  const matches: TProduct[] = [];

  for (const category of categories) {
    const products = [
      ...category.products,
      ...(category.subcategories?.flatMap((subcategory) => subcategory.products) ?? []),
    ];

    for (const product of products) {
      const searchSource = normalizeSearchText(
        `${product.name} ${product.description ?? ""}`,
      );

      if (searchSource.includes(query) && !seenProductIds.has(product.id)) {
        seenProductIds.add(product.id);
        matches.push(product);
      }
    }
  }

  return matches;
}

export function getMenuSearchEmptyState(query: string) {
  return {
    title: `No encontramos productos para “${query.trim()}”.`,
    description: "Probá con otro nombre o explorá una categoría.",
    actionLabel: "Ver todas las categorías",
  };
}

export function shouldShowTopLevelMenuHeading({
  hasSubcategories,
}: {
  hasSubcategories: boolean;
}) {
  return hasSubcategories;
}

export function shouldShowSubcategoryHeading() {
  return true;
}

export function shouldShowSubcategoryNav({
  subcategoryCount: _subcategoryCount,
}: {
  subcategoryCount: number;
}) {
  return false;
}
