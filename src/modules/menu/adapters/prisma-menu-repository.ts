import type { Decimal, InputJsonValue } from "@prisma/client/runtime/library";

import type {
  BundleRuleRecord,
  CategoryRecord,
  MenuMarketingBlockRecord,
  ModifierGroupRecord,
  ModifierOptionRecord,
  ProductImageRecord,
  ProductRecord,
  PublicMenuCategory,
  SubcategoryRecord,
} from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";
import { getPrismaClient } from "@/infrastructure/database/prisma";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function mapImage(image: {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
}): ProductImageRecord {
  return {
    id: image.id,
    url: image.url,
    alt: image.alt,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
  };
}

function mapOption(option: {
  id: string;
  name: string;
  priceDelta: Decimal;
  isActive: boolean;
  sortOrder: number;
}): ModifierOptionRecord {
  return {
    id: option.id,
    name: option.name,
    priceDelta: decimalToNumber(option.priceDelta),
    isActive: option.isActive,
  };
}

function mapModifierGroup(group: {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: {
    id: string;
    name: string;
    priceDelta: Decimal;
    isActive: boolean;
    sortOrder: number;
  }[];
}): ModifierGroupRecord {
  return {
    id: group.id,
    name: group.name,
    isRequired: group.isRequired,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    sortOrder: group.sortOrder,
    options: group.options.sort((a, b) => a.sortOrder - b.sortOrder).map(mapOption),
  };
}

function mapBundleRule(rule: {
  id: string;
  name: string;
  ruleType: string;
  config: unknown;
  isActive: boolean;
  sortOrder: number;
}): BundleRuleRecord {
  return {
    id: rule.id,
    name: rule.name,
    ruleType: rule.ruleType,
    config: rule.config,
    isActive: rule.isActive,
    sortOrder: rule.sortOrder,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(product: any): ProductRecord {
  return {
    id: product.id,
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId,
    name: product.name,
    description: product.description,
    basePrice: decimalToNumber(product.basePrice),
    packagingFeeAmount: product.packagingFeeAmount
      ? decimalToNumber(product.packagingFeeAmount)
      : null,
    images: (product.images as unknown[])
      .sort((a: unknown, b: unknown) => (a as {sortOrder: number}).sortOrder - (b as {sortOrder: number}).sortOrder)
      .map((img) => mapImage(img as { id: string; url: string; alt: string | null; sortOrder: number; isPrimary: boolean })),
    availability: {
      isAvailable: product.isAvailable,
      isActive: product.isActive,
    },
    modifierGroups: (product.modifierGroups as unknown[])
      .sort((a: unknown, b: unknown) => (a as {sortOrder: number}).sortOrder - (b as {sortOrder: number}).sortOrder)
      .map((mg) => mapModifierGroup((mg as { modifierGroup: unknown }).modifierGroup as {
        id: string; name: string; isRequired: boolean; minSelections: number; maxSelections: number;
        sortOrder: number;
        options: { id: string; name: string; priceDelta: Decimal; isActive: boolean; sortOrder: number }[];
      })),
    bundleRules: (product.bundleRules as unknown[])
      .sort((a: unknown, b: unknown) => (a as {sortOrder: number}).sortOrder - (b as {sortOrder: number}).sortOrder)
      .map((rule) => mapBundleRule(rule as { id: string; name: string; ruleType: string; config: unknown; isActive: boolean; sortOrder: number })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function mapSubcategory(subcategory: {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
}): SubcategoryRecord {
  return {
    id: subcategory.id,
    categoryId: subcategory.categoryId,
    name: subcategory.name,
    slug: subcategory.slug,
    sortOrder: subcategory.sortOrder,
    isActive: subcategory.isActive,
    ...(subcategory.productCount !== undefined ? { productCount: subcategory.productCount } : {}),
  };
}

function mapCategory(category: {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  color: string | null;
}): CategoryRecord {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    color: category.color,
  };
}

function mapMarketingBlock(block: {
  id: string;
  type: MenuMarketingBlockRecord["type"];
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaType: MenuMarketingBlockRecord["ctaType"];
  ctaTarget: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MenuMarketingBlockRecord {
  return {
    id: block.id,
    type: block.type,
    title: block.title,
    description: block.description,
    imageUrl: block.imageUrl,
    ctaLabel: block.ctaLabel,
    ctaType: block.ctaType,
    ctaTarget: block.ctaTarget,
    isActive: block.isActive,
    sortOrder: block.sortOrder,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  };
}

export class PrismaMenuRepository implements MenuRepository {
  async getPublicMenu(params: {
    categorySlug?: string;
    locationId?: string;
    includeUnavailable?: boolean;
  }): Promise<PublicMenuCategory[]> {
    const prisma = getPrismaClient();

    const whereCategory: { slug?: string; isActive: boolean } = { isActive: true };
    if (params.categorySlug) {
      whereCategory.slug = params.categorySlug;
    }

    const categories = await prisma.category.findMany({
      where: whereCategory,
      orderBy: { sortOrder: "asc" },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            products: {
              where: params.includeUnavailable
                ? { isActive: true }
                : { isActive: true, isAvailable: true },
              orderBy: { sortOrder: "asc" },
              include: {
                images: { orderBy: { sortOrder: "asc" } },
                modifierGroups: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    modifierGroup: {
                      include: {
                        options: { orderBy: { sortOrder: "asc" } },
                      },
                    },
                  },
                },
                bundleRules: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        products: {
          where: params.includeUnavailable
            ? { isActive: true, subcategoryId: null }
            : { isActive: true, isAvailable: true, subcategoryId: null },
          orderBy: { sortOrder: "asc" },
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            modifierGroups: {
              orderBy: { sortOrder: "asc" },
              include: {
                modifierGroup: {
                  include: {
                    options: { orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
            bundleRules: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    return categories.map((category: {
      id: string;
      name: string;
      slug: string;
      sortOrder: number;
      color: string | null;
      subcategories: Array<{
        id: string;
        name: string;
        slug: string;
        sortOrder: number;
        products: unknown[];
      }>;
      products: unknown[];
    }) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      sortOrder: category.sortOrder,
      color: category.color,
      subcategories: category.subcategories.map((sub: {
        id: string;
        name: string;
        slug: string;
        sortOrder: number;
        products: unknown[];
      }) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        sortOrder: sub.sortOrder,
        products: sub.products.map(mapProduct),
      })),
      products: category.products.map(mapProduct),
    }));
  }

  async listPublicMarketingBlocks(params: {
    now: Date;
  }): Promise<MenuMarketingBlockRecord[]> {
    const prisma = getPrismaClient();
    const blocks = await prisma.menuMarketingBlock.findMany({
      where: {
        isActive: true,
        AND: [
          {
            OR: [{ startsAt: null }, { startsAt: { lte: params.now } }],
          },
          {
            OR: [{ endsAt: null }, { endsAt: { gte: params.now } }],
          },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return blocks.map(mapMarketingBlock);
  }

  async listCategories(): Promise<CategoryRecord[]> {
    const prisma = getPrismaClient();
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        subcategories: {
          orderBy: { sortOrder: "asc" },
          include: {
            _count: { select: { products: true } },
          },
        },
      },
    });

    return categories.map((category: {
      id: string;
      name: string;
      slug: string;
      sortOrder: number;
      isActive: boolean;
      color: string | null;
      subcategories: Array<{
        id: string;
        categoryId: string;
        name: string;
        slug: string;
        sortOrder: number;
        isActive: boolean;
        _count: { products: number };
      }>;
    }) => ({
      ...mapCategory(category),
      subcategories: category.subcategories.map((subcategory) =>
        mapSubcategory({ ...subcategory, productCount: subcategory._count.products }),
      ),
    }));
  }

  async createCategory(input: {
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
    color?: string | null;
  }): Promise<CategoryRecord> {
    const prisma = getPrismaClient();
    const category = await prisma.category.create({
      data: input,
    });
    return { ...mapCategory(category), subcategories: [] };
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
    const prisma = getPrismaClient();
    const category = await prisma.category.update({
      where: { id },
      data: input,
    });
    return { ...mapCategory(category), subcategories: [] };
  }

  async findCategoryById(id: string): Promise<CategoryRecord | null> {
    const prisma = getPrismaClient();
    const category = await prisma.category.findUnique({
      where: { id },
    });
    return category ? { ...mapCategory(category), subcategories: [] } : null;
  }

  async findCategoryBySlug(slug: string): Promise<CategoryRecord | null> {
    const prisma = getPrismaClient();
    const category = await prisma.category.findUnique({
      where: { slug },
    });
    return category ? { ...mapCategory(category), subcategories: [] } : null;
  }

  async listSubcategories(params: {
    categoryId?: string;
    isActive?: boolean;
  }): Promise<SubcategoryRecord[]> {
    const prisma = getPrismaClient();
    const where: { categoryId?: string; isActive?: boolean } = {};
    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }

    const subcategories = await prisma.subcategory.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return subcategories.map(mapSubcategory);
  }

  async createSubcategory(input: {
    categoryId: string;
    name: string;
    slug: string;
    sortOrder: number;
    isActive: boolean;
  }): Promise<SubcategoryRecord> {
    const prisma = getPrismaClient();
    const subcategory = await prisma.subcategory.create({
      data: input,
    });
    return mapSubcategory(subcategory);
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
    const prisma = getPrismaClient();
    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: input,
    });
    return mapSubcategory(subcategory);
  }

  async moveSubcategory(
    id: string,
    categoryId: string,
  ): Promise<{ subcategory: SubcategoryRecord; movedProducts: number }> {
    const prisma = getPrismaClient();
    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.updateMany({
        where: { subcategoryId: id },
        data: { categoryId },
      });
      const subcategory = await tx.subcategory.update({
        where: { id },
        data: { categoryId },
      });

      return { subcategory, movedProducts: products.count };
    });

    return {
      subcategory: mapSubcategory(result.subcategory),
      movedProducts: result.movedProducts,
    };
  }

  async deleteSubcategory(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.subcategory.delete({
      where: { id },
    });
  }

  async findSubcategoryById(id: string): Promise<SubcategoryRecord | null> {
    const prisma = getPrismaClient();
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
    });
    return subcategory ? mapSubcategory(subcategory) : null;
  }

  async findSubcategoryBySlugInCategory(
    categoryId: string,
    slug: string,
  ): Promise<SubcategoryRecord | null> {
    const prisma = getPrismaClient();
    const subcategory = await prisma.subcategory.findUnique({
      where: { categoryId_slug: { categoryId, slug } },
    });
    return subcategory ? mapSubcategory(subcategory) : null;
  }

  async countProductsBySubcategory(subcategoryId: string): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.product.count({
      where: { subcategoryId, isActive: true },
    });
  }

  async listProducts(params: {
    categoryId?: string;
    subcategoryId?: string;
    isActive?: boolean;
    isAvailable?: boolean;
    search?: string;
  }): Promise<ProductRecord[]> {
    const prisma = getPrismaClient();
    const where: {
      categoryId?: string;
      subcategoryId?: string | null;
      isActive?: boolean;
      isAvailable?: boolean;
      name?: { contains: string; mode: "insensitive" };
    } = {};

    if (params.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (params.subcategoryId !== undefined) {
      where.subcategoryId = params.subcategoryId;
    }
    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }
    if (typeof params.isAvailable === "boolean") {
      where.isAvailable = params.isAvailable;
    }
    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            modifierGroup: {
              include: {
                options: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        bundleRules: { orderBy: { sortOrder: "asc" } },
      },
    });

    return products.map(mapProduct);
  }

  async getProductById(id: string): Promise<ProductRecord | null> {
    const prisma = getPrismaClient();
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            modifierGroup: {
              include: {
                options: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        bundleRules: { orderBy: { sortOrder: "asc" } },
      },
    });

    return product ? mapProduct(product) : null;
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
    const prisma = getPrismaClient();

    const product = await prisma.product.create({
      data: {
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId ?? null,
        name: input.name,
        description: input.description ?? null,
        basePrice: input.basePrice,
        packagingFeeAmount: input.packagingFeeAmount ?? null,
        isAvailable: input.isAvailable,
        isActive: input.isActive,
        images: {
          create: input.images.map((img, idx) => ({
            url: img.url,
            alt: img.alt ?? null,
            sortOrder: img.sortOrder ?? idx,
            isPrimary: img.isPrimary ?? idx === 0,
          })),
        },
        modifierGroups: input.modifierGroupIds?.length
          ? {
              create: input.modifierGroupIds.map((id, idx) => ({
                modifierGroup: { connect: { id } },
                sortOrder: idx,
              })),
            }
          : undefined,
        bundleRules: input.bundleRules?.length
          ? {
              create: input.bundleRules.map((rule, idx) => ({
                name: rule.name,
                ruleType: rule.ruleType,
                config: (rule.config ?? {}) as InputJsonValue,
                isActive: rule.isActive ?? true,
                sortOrder: rule.sortOrder ?? idx,
              })),
            }
          : undefined,
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            modifierGroup: {
              include: {
                options: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        bundleRules: { orderBy: { sortOrder: "asc" } },
      },
    });

    return mapProduct(product);
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
    const prisma = getPrismaClient();

    const data: {
      category?: { connect: { id: string } };
      subcategory?: { connect: { id: string } } | { disconnect: true };
      name?: string;
      description?: string | null;
      basePrice?: number;
      packagingFeeAmount?: number | null;
      isAvailable?: boolean;
      isActive?: boolean;
      images?: {
        deleteMany: Record<string, never>;
        create: Array<{
          url: string;
          alt: string | null;
          sortOrder: number;
          isPrimary: boolean;
        }>;
      };
      modifierGroups?: {
        deleteMany: Record<string, never>;
        create: Array<{
          modifierGroup: { connect: { id: string } };
          sortOrder: number;
        }>;
      };
      bundleRules?: {
        deleteMany: Record<string, never>;
        create: Array<{
          name: string;
          ruleType: string;
          config: InputJsonValue;
          isActive: boolean;
          sortOrder: number;
        }>;
      };
    } = {};

    if (input.categoryId !== undefined) {
      data.category = { connect: { id: input.categoryId } };
    }
    if (input.subcategoryId !== undefined) {
      data.subcategory = input.subcategoryId
        ? { connect: { id: input.subcategoryId } }
        : { disconnect: true };
    }
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.description !== undefined) {
      data.description = input.description ?? null;
    }
    if (input.basePrice !== undefined) {
      data.basePrice = input.basePrice;
    }
    if (input.packagingFeeAmount !== undefined) {
      data.packagingFeeAmount = input.packagingFeeAmount ?? null;
    }
    if (input.isAvailable !== undefined) {
      data.isAvailable = input.isAvailable;
    }
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    if (input.images) {
      data.images = {
        deleteMany: {},
        create: input.images.map((img, idx) => ({
          url: img.url,
          alt: img.alt ?? null,
          sortOrder: img.sortOrder ?? idx,
          isPrimary: img.isPrimary ?? idx === 0,
        })),
      };
    }

    if (input.modifierGroupIds) {
      data.modifierGroups = {
        deleteMany: {},
        create: input.modifierGroupIds.map((groupId, idx) => ({
          modifierGroup: { connect: { id: groupId } },
          sortOrder: idx,
        })),
      };
    }

    if (input.bundleRules) {
      data.bundleRules = {
        deleteMany: {},
        create: input.bundleRules.map((rule, idx) => ({
          name: rule.name,
          ruleType: rule.ruleType,
          config: (rule.config ?? {}) as InputJsonValue,
          isActive: rule.isActive ?? true,
          sortOrder: rule.sortOrder ?? idx,
        })),
      };
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            modifierGroup: {
              include: {
                options: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
        bundleRules: { orderBy: { sortOrder: "asc" } },
      },
    });

    return mapProduct(product);
  }

  async listMarketingBlocks(): Promise<MenuMarketingBlockRecord[]> {
    const prisma = getPrismaClient();
    const blocks = await prisma.menuMarketingBlock.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return blocks.map(mapMarketingBlock);
  }

  async findMarketingBlockById(id: string): Promise<MenuMarketingBlockRecord | null> {
    const prisma = getPrismaClient();
    const block = await prisma.menuMarketingBlock.findUnique({
      where: { id },
    });
    return block ? mapMarketingBlock(block) : null;
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
    const prisma = getPrismaClient();
    const block = await prisma.menuMarketingBlock.create({
      data: {
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
      },
    });
    return mapMarketingBlock(block);
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
    const prisma = getPrismaClient();
    const block = await prisma.menuMarketingBlock.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
        ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel ?? null } : {}),
        ...(input.ctaType !== undefined ? { ctaType: input.ctaType } : {}),
        ...(input.ctaTarget !== undefined ? { ctaTarget: input.ctaTarget ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt ?? null } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt ?? null } : {}),
      },
    });
    return mapMarketingBlock(block);
  }

  async listModifierGroups(): Promise<ModifierGroupRecord[]> {
    const prisma = getPrismaClient();
    const groups = await prisma.modifierGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
      },
    });
    return groups.map(mapModifierGroup);
  }

  async listModifierGroupsByIds(ids: string[]): Promise<ModifierGroupRecord[]> {
    const prisma = getPrismaClient();
    const groups = await prisma.modifierGroup.findMany({
      where: { id: { in: ids } },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
      },
    });
    return groups.map(mapModifierGroup);
  }

  async getModifierGroupById(id: string): Promise<ModifierGroupRecord | null> {
    const prisma = getPrismaClient();
    const group = await prisma.modifierGroup.findUnique({
      where: { id },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
      },
    });
    return group ? mapModifierGroup(group) : null;
  }

  async createModifierGroup(input: {
    name: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    sortOrder: number;
    options: { name: string; priceDelta: number; isActive: boolean; sortOrder: number }[];
  }): Promise<ModifierGroupRecord> {
    const prisma = getPrismaClient();
    const group = await prisma.modifierGroup.create({
      data: {
        name: input.name,
        isRequired: input.isRequired,
        minSelections: input.minSelections,
        maxSelections: input.maxSelections,
        sortOrder: input.sortOrder,
        options: {
          create: input.options.map((opt) => ({
            name: opt.name,
            priceDelta: opt.priceDelta,
            isActive: opt.isActive,
            sortOrder: opt.sortOrder,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
      },
    });
    return mapModifierGroup(group);
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
    const prisma = getPrismaClient();

    const groupData: {
      name?: string;
      isRequired?: boolean;
      minSelections?: number;
      maxSelections?: number;
      sortOrder?: number;
    } = {};

    if (input.name !== undefined) groupData.name = input.name;
    if (input.isRequired !== undefined) groupData.isRequired = input.isRequired;
    if (input.minSelections !== undefined) groupData.minSelections = input.minSelections;
    if (input.maxSelections !== undefined) groupData.maxSelections = input.maxSelections;
    if (input.sortOrder !== undefined) groupData.sortOrder = input.sortOrder;

    await prisma.modifierGroup.update({
      where: { id },
      data: groupData,
    });

    if (input.options) {
      const incomingIds = input.options
        .map((o) => o.id)
        .filter((id): id is string => id !== undefined && id.length > 0);

      // Validate ownership of all incoming option IDs before any mutation
      if (incomingIds.length > 0) {
        const existingOptions = await prisma.modifierOption.findMany({
          where: { id: { in: incomingIds }, modifierGroupId: id },
        });
        const validIds = new Set(existingOptions.map((o: { id: string }) => o.id));
        for (const optId of incomingIds) {
          if (!validIds.has(optId)) {
            throw new Error(
              `ModifierOption ${optId} does not belong to ModifierGroup ${id}`,
            );
          }
        }
      }

      // Delete options that are no longer present
      if (incomingIds.length > 0) {
        await prisma.modifierOption.deleteMany({
          where: { modifierGroupId: id, id: { notIn: incomingIds } },
        });
      } else {
        await prisma.modifierOption.deleteMany({
          where: { modifierGroupId: id },
        });
      }

      // Update existing or create new options
      for (const opt of input.options) {
        if (opt.id) {
          await prisma.modifierOption.update({
            where: { id: opt.id },
            data: {
              name: opt.name,
              priceDelta: opt.priceDelta,
              isActive: opt.isActive,
              sortOrder: opt.sortOrder,
            },
          });
        } else {
          await prisma.modifierOption.create({
            data: {
              modifierGroupId: id,
              name: opt.name,
              priceDelta: opt.priceDelta,
              isActive: opt.isActive,
              sortOrder: opt.sortOrder,
            },
          });
        }
      }
    }

    const group = await prisma.modifierGroup.findUniqueOrThrow({
      where: { id },
      include: {
        options: { orderBy: { sortOrder: "asc" } },
      },
    });

    return mapModifierGroup(group);
  }
}
