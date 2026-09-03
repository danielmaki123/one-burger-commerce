import { MenuError } from "@/modules/menu/domain/menu-errors";
import type {
  BundleRuleRecord,
  ProductImageRecord,
  ProductRecord,
} from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ModifierGroupRef = {
  id: string;
};

type CreateProductInput = {
  categoryId: string;
  subcategoryId?: string | null;
  name: string;
  description?: string | null;
  basePrice: number;
  packagingFeeAmount?: number | null;
  images?: Omit<ProductImageRecord, "id">[];
  availability?: {
    isAvailable: boolean;
    isActive: boolean;
  };
  modifierGroups?: ModifierGroupRef[];
  bundleRules?: Omit<BundleRuleRecord, "id">[];
};

type CreateProductDependencies = {
  repository: MenuRepository;
};

export async function createProduct(
  input: CreateProductInput,
  { repository }: CreateProductDependencies,
): Promise<{ data: ProductRecord; meta: { updatedAt: string } }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  if (!input.categoryId || input.categoryId.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", {
      categoryId: "Required",
    });
  }

  if (typeof input.basePrice !== "number" || input.basePrice < 0) {
    throw new MenuError(422, "VALIDATION_ERROR", "Invalid basePrice");
  }

  if (
    input.packagingFeeAmount !== undefined &&
    input.packagingFeeAmount !== null &&
    (typeof input.packagingFeeAmount !== "number" || input.packagingFeeAmount < 0)
  ) {
    throw new MenuError(422, "VALIDATION_ERROR", "Invalid packagingFeeAmount");
  }

  const category = await repository.findCategoryById(input.categoryId);
  if (!category) {
    throw new MenuError(404, "NOT_FOUND", "Category not found");
  }

  if (input.subcategoryId) {
    const subcategory = await repository.findSubcategoryById(input.subcategoryId);
    if (!subcategory) {
      throw new MenuError(404, "NOT_FOUND", "Subcategory not found");
    }
    if (subcategory.categoryId !== input.categoryId) {
      throw new MenuError(
        409,
        "CONFLICT",
        "Subcategory does not belong to the specified category",
      );
    }
  }

  if (input.bundleRules !== undefined && input.bundleRules.length > 0) {
    throw new MenuError(422, "VALIDATION_ERROR", "bundleRules not supported in this phase", {
      bundleRules: "Must be empty",
    });
  }

  const modifierGroupIds: string[] = [];
  if (input.modifierGroups !== undefined && input.modifierGroups.length > 0) {
    const ids = input.modifierGroups.map((mg) => mg.id);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      throw new MenuError(422, "VALIDATION_ERROR", "Duplicate modifier group IDs", {
        modifierGroups: "Contains duplicates",
      });
    }

    const existingGroups = await repository.listModifierGroupsByIds(ids);
    if (existingGroups.length !== ids.length) {
      throw new MenuError(422, "VALIDATION_ERROR", "One or more modifier groups do not exist", {
        modifierGroups: "Invalid reference",
      });
    }

    modifierGroupIds.push(...ids);
  }

  const images = input.images ?? [];
  for (const img of images) {
    if (!img.url || img.url.trim().length === 0) {
      throw new MenuError(422, "VALIDATION_ERROR", "Each image requires a url");
    }
  }

  const product = await repository.createProduct({
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId ?? null,
    name: input.name.trim(),
    description: input.description ?? null,
    basePrice: input.basePrice,
    packagingFeeAmount: input.packagingFeeAmount ?? null,
    images,
    isAvailable: input.availability?.isAvailable ?? true,
    isActive: input.availability?.isActive ?? true,
    modifierGroupIds,
    bundleRules: input.bundleRules ?? [],
  });

  return {
    data: product,
    meta: { updatedAt: new Date().toISOString() },
  };
}
