export type ProductImageRecord = {
  id: string;
  url: string;
  alt?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
};

export type ModifierOptionRecord = {
  id: string;
  name: string;
  priceDelta: number;
  isActive: boolean;
};

export type ModifierGroupRecord = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOptionRecord[];
};

export type BundleRuleRecord = {
  id: string;
  name: string;
  ruleType: string;
  config?: unknown;
  isActive?: boolean;
  sortOrder?: number;
};

export type MenuMarketingBlockType =
  | "promo"
  | "event"
  | "combo"
  | "featured"
  | "info";

export type MenuMarketingBlockCtaType =
  | "none"
  | "product"
  | "category"
  | "url";

export type MenuMarketingBlockRecord = {
  id: string;
  type: MenuMarketingBlockType;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaType: MenuMarketingBlockCtaType;
  ctaTarget: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicMenuMarketingBlock = {
  id: string;
  type: MenuMarketingBlockType;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaType: MenuMarketingBlockCtaType;
  ctaHref: string | null;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type ProductRecord = {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  name: string;
  description: string | null;
  basePrice: number;
  packagingFeeAmount: number | null;
  images: ProductImageRecord[];
  availability: {
    isAvailable: boolean;
    isActive: boolean;
  };
  modifierGroups: ModifierGroupRecord[];
  bundleRules: BundleRuleRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export type SubcategoryRecord = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
  products?: ProductRecord[];
};

export type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  /** Color de la carta pública (`#rrggbb`) o `null` si el owner no eligió ninguno. */
  color: string | null;
  subcategories?: SubcategoryRecord[];
  products?: ProductRecord[];
};

export type PublicMenuCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  /** Color elegido por el owner para las tarjetas de esta categoría. */
  color: string | null;
  subcategories: {
    id: string;
    name: string;
    slug: string;
    sortOrder: number;
    products: ProductRecord[];
  }[];
  products: ProductRecord[];
};
