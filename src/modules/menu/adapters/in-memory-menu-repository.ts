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
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

export class InMemoryMenuRepository implements MenuRepository {
  categories: CategoryRecord[] = [];
  subcategories: SubcategoryRecord[] = [];
  products: ProductRecord[] = [];
  modifierGroups: ModifierGroupRecord[] = [];
  marketingBlocks: MenuMarketingBlockRecord[] = [];

  async getPublicMenu(params: {
    categorySlug?: string;
    includeUnavailable?: boolean;
  }): Promise<PublicMenuCategory[]> {
    // El doble respeta la misma pregunta que el adaptador de Prisma: `includeUnavailable` decide si el
    // agotado viaja (el mostrador lo necesita, la carta no). Estaba ignorado y el doble devolvía siempre
    // todo lo activo: medía un catálogo que producción no entrega.
    const visible = (product: ProductRecord) =>
      product.availability.isActive &&
      (Boolean(params.includeUnavailable) || product.availability.isAvailable);

    return this.categories
      .filter((c) => c.isActive)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        color: category.color,
        subcategories: (category.subcategories ?? [])
          .filter((s) => s.isActive)
          .map((sub) => ({
            id: sub.id,
            name: sub.name,
            slug: sub.slug,
            sortOrder: sub.sortOrder,
            products: this.products.filter(
              (p) => p.subcategoryId === sub.id && visible(p),
            ),
          })),
        products: this.products.filter(
          (p) => p.categoryId === category.id && !p.subcategoryId && visible(p),
        ),
      }));
  }

  async listPublicMarketingBlocks(params: {
    now: Date;
  }): Promise<MenuMarketingBlockRecord[]> {
    return this.marketingBlocks
      .filter((block) => {
        if (!block.isActive) return false;
        if (block.startsAt && block.startsAt > params.now) return false;
        if (block.endsAt && block.endsAt < params.now) return false;
        return true;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listCategories(): Promise<CategoryRecord[]> {
    return this.categories.map((c) => ({
      ...c,
      subcategories: this.subcategories
        .filter((s) => s.categoryId === c.id)
        .map((subcategory) => ({
          ...subcategory,
          productCount: this.products.filter((product) => product.subcategoryId === subcategory.id)
            .length,
        })),
    }));
  }

  async createCategory(input: {
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
    color?: string | null;
  }): Promise<CategoryRecord> {
    const category: CategoryRecord = {
      id: `cat_${this.categories.length + 1}`,
      ...input,
      color: input.color ?? null,
      subcategories: [],
    };
    this.categories.push(category);
    return category;
  }

  async updateCategory(
    id: string,
    input: {
      name?: string;
      slug?: string;
      sortOrder?: number;
      isActive?: boolean;
      color?: string | null;
    },
  ): Promise<CategoryRecord> {
    const category = this.categories.find((c) => c.id === id);
    if (!category) throw new Error("Category not found");
    Object.assign(category, input);
    return category;
  }

  async findCategoryById(id: string): Promise<CategoryRecord | null> {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  async findCategoryBySlug(slug: string): Promise<CategoryRecord | null> {
    return this.categories.find((c) => c.slug === slug) ?? null;
  }

  async listSubcategories(params: {
    categoryId?: string;
    isActive?: boolean;
  }): Promise<SubcategoryRecord[]> {
    return this.subcategories.filter((s) => {
      if (params.categoryId && s.categoryId !== params.categoryId) return false;
      if (typeof params.isActive === "boolean" && s.isActive !== params.isActive) return false;
      return true;
    });
  }

  async createSubcategory(input: {
    categoryId: string;
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
  }): Promise<SubcategoryRecord> {
    const subcategory: SubcategoryRecord = {
      id: `sub_${this.subcategories.length + 1}`,
      ...input,
    };
    this.subcategories.push(subcategory);
    return subcategory;
  }

  async updateSubcategory(
    id: string,
    input: {
      name?: string;
      slug?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<SubcategoryRecord> {
    const subcategory = this.subcategories.find((s) => s.id === id);
    if (!subcategory) throw new Error("Subcategory not found");
    Object.assign(subcategory, input);
    return subcategory;
  }

  async moveSubcategory(
    id: string,
    categoryId: string,
  ): Promise<{ subcategory: SubcategoryRecord; movedProducts: number }> {
    const subcategory = this.subcategories.find((s) => s.id === id);
    if (!subcategory) throw new Error("Subcategory not found");

    const affectedProducts = this.products.filter((product) => product.subcategoryId === id);
    affectedProducts.forEach((product) => {
      product.categoryId = categoryId;
    });
    subcategory.categoryId = categoryId;

    return { subcategory, movedProducts: affectedProducts.length };
  }

  async deleteSubcategory(id: string): Promise<void> {
    const idx = this.subcategories.findIndex((s) => s.id === id);
    if (idx >= 0) this.subcategories.splice(idx, 1);
  }

  async findSubcategoryById(id: string): Promise<SubcategoryRecord | null> {
    return this.subcategories.find((s) => s.id === id) ?? null;
  }

  async findSubcategoryBySlugInCategory(
    categoryId: string,
    slug: string,
  ): Promise<SubcategoryRecord | null> {
    return this.subcategories.find((s) => s.categoryId === categoryId && s.slug === slug) ?? null;
  }

  async countProductsBySubcategory(subcategoryId: string): Promise<number> {
    return this.products.filter((p) => p.subcategoryId === subcategoryId && p.availability.isActive)
      .length;
  }

  async listProducts(_params: {
    categoryId?: string;
    subcategoryId?: string;
    isActive?: boolean;
    isAvailable?: boolean;
    search?: string;
  }): Promise<ProductRecord[]> {
    return this.products;
  }

  async getProductById(id: string): Promise<ProductRecord | null> {
    return this.products.find((p) => p.id === id) ?? null;
  }

  async createProduct(input: {
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
  }): Promise<ProductRecord> {
    const product: ProductRecord = {
      id: `prod_${this.products.length + 1}`,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId ?? null,
      name: input.name,
      description: input.description ?? null,
      basePrice: input.basePrice,
      packagingFeeAmount: input.packagingFeeAmount ?? null,
      images: input.images.map((img, idx) => ({
        id: `img_${this.products.length + 1}_${idx}`,
        ...img,
      })),
      availability: {
        isAvailable: input.isAvailable,
        isActive: input.isActive,
      },
      modifierGroups: (input.modifierGroupIds ?? []).map((id) => {
        const group = this.modifierGroups.find((g) => g.id === id);
        if (!group) throw new Error(`Modifier group ${id} not found`);
        return group;
      }),
      bundleRules: (input.bundleRules ?? []).map((rule, idx) => ({
        id: `bundle_${this.products.length + 1}_${idx}`,
        ...rule,
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.products.push(product);
    return product;
  }

  async updateProduct(
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
  ): Promise<ProductRecord> {
    const product = this.products.find((p) => p.id === id);
    if (!product) throw new Error("Product not found");
    if (input.categoryId !== undefined) product.categoryId = input.categoryId;
    if (input.subcategoryId !== undefined) product.subcategoryId = input.subcategoryId ?? null;
    if (input.name !== undefined) product.name = input.name;
    if (input.description !== undefined) product.description = input.description ?? null;
    if (input.basePrice !== undefined) product.basePrice = input.basePrice;
    if (input.packagingFeeAmount !== undefined) product.packagingFeeAmount = input.packagingFeeAmount ?? null;
    if (input.isAvailable !== undefined) product.availability.isAvailable = input.isAvailable;
    if (input.isActive !== undefined) product.availability.isActive = input.isActive;
    if (input.images) {
      product.images = input.images.map((img, idx) => ({
        id: `img_${id}_${idx}`,
        ...img,
      }));
    }
    if (input.bundleRules) {
      product.bundleRules = input.bundleRules.map((rule, idx) => ({
        id: `bundle_${id}_${idx}`,
        ...rule,
      }));
    }
    if (input.modifierGroupIds !== undefined) {
      product.modifierGroups = input.modifierGroupIds.map((mgId) => {
        const group = this.modifierGroups.find((g) => g.id === mgId);
        if (!group) throw new Error(`Modifier group ${mgId} not found`);
        return group;
      });
    }
    product.updatedAt = new Date();
    return product;
  }

  async listMarketingBlocks(): Promise<MenuMarketingBlockRecord[]> {
    return [...this.marketingBlocks].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findMarketingBlockById(id: string): Promise<MenuMarketingBlockRecord | null> {
    return this.marketingBlocks.find((block) => block.id === id) ?? null;
  }

  async createMarketingBlock(input: {
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
  }): Promise<MenuMarketingBlockRecord> {
    const block: MenuMarketingBlockRecord = {
      id: `mkt_${this.marketingBlocks.length + 1}`,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      ctaLabel: input.ctaLabel ?? null,
      ctaType: input.ctaType,
      ctaTarget: input.ctaTarget ?? null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.marketingBlocks.push(block);
    return block;
  }

  async updateMarketingBlock(
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
  ): Promise<MenuMarketingBlockRecord> {
    const block = this.marketingBlocks.find((item) => item.id === id);
    if (!block) throw new Error("Marketing block not found");

    if (input.type !== undefined) block.type = input.type;
    if (input.title !== undefined) block.title = input.title;
    if (input.description !== undefined) block.description = input.description ?? null;
    if (input.imageUrl !== undefined) block.imageUrl = input.imageUrl ?? null;
    if (input.ctaLabel !== undefined) block.ctaLabel = input.ctaLabel ?? null;
    if (input.ctaType !== undefined) block.ctaType = input.ctaType;
    if (input.ctaTarget !== undefined) block.ctaTarget = input.ctaTarget ?? null;
    if (input.isActive !== undefined) block.isActive = input.isActive;
    if (input.sortOrder !== undefined) block.sortOrder = input.sortOrder;
    if (input.startsAt !== undefined) block.startsAt = input.startsAt ?? null;
    if (input.endsAt !== undefined) block.endsAt = input.endsAt ?? null;
    block.updatedAt = new Date();

    return block;
  }

  async getModifierGroupById(id: string): Promise<ModifierGroupRecord | null> {
    return this.modifierGroups.find((g) => g.id === id) ?? null;
  }

  async createModifierGroup(input: {
    name: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    options: { name: string; priceDelta: number; isActive: boolean; sortOrder: number }[];
  }): Promise<ModifierGroupRecord> {
    const group: ModifierGroupRecord = {
      id: `mg_${this.modifierGroups.length + 1}`,
      name: input.name,
      isRequired: input.isRequired,
      minSelections: input.minSelections,
      maxSelections: input.maxSelections,
      sortOrder: input.sortOrder,
      options: input.options.map((opt, idx) => ({
        id: `mo_${this.modifierGroups.length + 1}_${idx}`,
        ...opt,
      })),
    };
    this.modifierGroups.push(group);
    return group;
  }

  async updateModifierGroup(
    id: string,
    input: {
      name?: string;
      isRequired?: boolean;
      minSelections?: number;
      maxSelections?: number;
      sortOrder?: number;
      options?: { id?: string; name: string; priceDelta: number; isActive: boolean; sortOrder: number }[];
    },
  ): Promise<ModifierGroupRecord> {
    const group = this.modifierGroups.find((g) => g.id === id);
    if (!group) throw new Error("ModifierGroup not found");

    if (input.name !== undefined) group.name = input.name;
    if (input.isRequired !== undefined) group.isRequired = input.isRequired;
    if (input.minSelections !== undefined) group.minSelections = input.minSelections;
    if (input.maxSelections !== undefined) group.maxSelections = input.maxSelections;
    if (input.sortOrder !== undefined) group.sortOrder = input.sortOrder;

    if (input.options) {
      const incomingIds = new Set(
        input.options.map((o) => o.id).filter((id): id is string => id !== undefined && id.length > 0),
      );

      // Validate ownership of all incoming option IDs before any mutation
      for (const optId of incomingIds) {
        if (!group.options.find((o) => o.id === optId)) {
          throw new Error(
            `ModifierOption ${optId} does not belong to ModifierGroup ${id}`,
          );
        }
      }

      // Remove options that are no longer present
      group.options = group.options.filter((o) => incomingIds.has(o.id));

      // Update existing or add new options
      for (let i = 0; i < input.options.length; i++) {
        const opt = input.options[i];
        if (opt.id) {
          const existing = group.options.find((o) => o.id === opt.id);
          if (existing) {
            existing.name = opt.name;
            existing.priceDelta = opt.priceDelta;
            existing.isActive = opt.isActive;
          }
        } else {
          group.options.push({
            id: `mo_${id}_${i}_${Date.now()}`,
            name: opt.name,
            priceDelta: opt.priceDelta,
            isActive: opt.isActive,
          });
        }
      }
    }

    return group;
  }

  async listModifierGroups(): Promise<ModifierGroupRecord[]> {
    return this.modifierGroups;
  }

  async listModifierGroupsByIds(ids: string[]): Promise<ModifierGroupRecord[]> {
    return this.modifierGroups.filter((g) => ids.includes(g.id));
  }
}
