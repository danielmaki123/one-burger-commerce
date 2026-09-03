import type {
  BundleRuleRecord,
  CategoryRecord,
  MenuMarketingBlockRecord,
  ModifierGroupRecord,
  ProductImageRecord,
  ProductRecord,
  PublicMenuCategory,
  SubcategoryRecord,
} from "@/modules/menu/domain/menu.types";

export interface MenuRepository {
  // Public menu
  getPublicMenu(params: {
    categorySlug?: string;
    locationId?: string;
    includeUnavailable?: boolean;
  }): Promise<PublicMenuCategory[]>;
  listPublicMarketingBlocks(params: {
    now: Date;
  }): Promise<MenuMarketingBlockRecord[]>;

  // Categories
  listCategories(): Promise<CategoryRecord[]>;
  createCategory(input: {
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
  }): Promise<CategoryRecord>;
  updateCategory(
    id: string,
    input: {
      name?: string;
      slug?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<CategoryRecord>;
  findCategoryById(id: string): Promise<CategoryRecord | null>;
  findCategoryBySlug(slug: string): Promise<CategoryRecord | null>;

  // Subcategories
  listSubcategories(params: {
    categoryId?: string;
    isActive?: boolean;
  }): Promise<SubcategoryRecord[]>;
  createSubcategory(input: {
    categoryId: string;
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
  }): Promise<SubcategoryRecord>;
  updateSubcategory(
    id: string,
    input: {
      name?: string;
      slug?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<SubcategoryRecord>;
  moveSubcategory(
    id: string,
    categoryId: string,
  ): Promise<{ subcategory: SubcategoryRecord; movedProducts: number }>;
  deleteSubcategory(id: string): Promise<void>;
  findSubcategoryById(id: string): Promise<SubcategoryRecord | null>;
  findSubcategoryBySlugInCategory(
    categoryId: string,
    slug: string,
  ): Promise<SubcategoryRecord | null>;
  countProductsBySubcategory(subcategoryId: string): Promise<number>;

  // Products
  listProducts(params: {
    categoryId?: string;
    subcategoryId?: string;
    isActive?: boolean;
    isAvailable?: boolean;
    search?: string;
  }): Promise<ProductRecord[]>;
  getProductById(id: string): Promise<ProductRecord | null>;
  createProduct(input: {
    categoryId: string;
    subcategoryId?: string | null;
    name: string;
    description?: string | null;
    basePrice: number;
    packagingFeeAmount?: number | null;
    images: Omit<ProductImageRecord, "id">[];
    isAvailable: boolean;
    isActive: boolean;
    modifierGroupIds?: string[];
    bundleRules?: Omit<BundleRuleRecord, "id">[];
  }): Promise<ProductRecord>;
  updateProduct(
    id: string,
    input: {
      categoryId?: string;
      subcategoryId?: string | null;
      name?: string;
      description?: string | null;
      basePrice?: number;
      packagingFeeAmount?: number | null;
      images?: Omit<ProductImageRecord, "id">[];
      isAvailable?: boolean;
      isActive?: boolean;
      modifierGroupIds?: string[];
      bundleRules?: Omit<BundleRuleRecord, "id">[];
    },
  ): Promise<ProductRecord>;

  // Marketing blocks
  listMarketingBlocks(): Promise<MenuMarketingBlockRecord[]>;
  findMarketingBlockById(id: string): Promise<MenuMarketingBlockRecord | null>;
  createMarketingBlock(input: {
    type: MenuMarketingBlockRecord["type"];
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    ctaLabel?: string | null;
    ctaType: MenuMarketingBlockRecord["ctaType"];
    ctaTarget?: string | null;
    isActive: boolean;
    sortOrder: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<MenuMarketingBlockRecord>;
  updateMarketingBlock(
    id: string,
    input: {
      type?: MenuMarketingBlockRecord["type"];
      title?: string;
      description?: string | null;
      imageUrl?: string | null;
      ctaLabel?: string | null;
      ctaType?: MenuMarketingBlockRecord["ctaType"];
      ctaTarget?: string | null;
      isActive?: boolean;
      sortOrder?: number;
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
  ): Promise<MenuMarketingBlockRecord>;

  // Modifiers
  listModifierGroups(): Promise<ModifierGroupRecord[]>;
  listModifierGroupsByIds(ids: string[]): Promise<ModifierGroupRecord[]>;
  getModifierGroupById(id: string): Promise<ModifierGroupRecord | null>;
  createModifierGroup(input: {
    name: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    options: { name: string; priceDelta: number; isActive: boolean; sortOrder: number }[];
  }): Promise<ModifierGroupRecord>;
  updateModifierGroup(
    id: string,
    input: {
      name?: string;
      isRequired?: boolean;
      minSelections?: number;
      maxSelections?: number;
      sortOrder?: number;
      options?: { id?: string; name: string; priceDelta: number; isActive: boolean; sortOrder: number }[];
    },
  ): Promise<ModifierGroupRecord>;
}
