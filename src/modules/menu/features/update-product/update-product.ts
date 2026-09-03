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

type UpdateProductInput = {
  categoryId?: string;
  subcategoryId?: string | null;
  name?: string;
  description?: string | null;
  basePrice?: number;
  packagingFeeAmount?: number | null;
  images?: Omit<ProductImageRecord, "id">[];
  availability?: {
    isAvailable: boolean;
    isActive: boolean;
  };
  modifierGroups?: ModifierGroupRef[];
  bundleRules?: Omit<BundleRuleRecord, "id">[];
};

type UpdateProductDependencies = {
  repository: MenuRepository;
};

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  { repository }: UpdateProductDependencies,
): Promise<{ data: ProductRecord; meta: { updatedAt: string } }> {
  const existing = await repository.getProductById(id);
  if (!existing) {
    throw new MenuError(404, "NOT_FOUND", "Product not found");
  }

  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  if (input.basePrice !== undefined && (typeof input.basePrice !== "number" || input.basePrice < 0)) {
    throw new MenuError(422, "VALIDATION_ERROR", "Invalid basePrice");
  }

  if (
    input.packagingFeeAmount !== undefined &&
    input.packagingFeeAmount !== null &&
    (typeof input.packagingFeeAmount !== "number" || input.packagingFeeAmount < 0)
  ) {
    throw new MenuError(422, "VALIDATION_ERROR", "Invalid packagingFeeAmount");
  }

  const categoryId = input.categoryId ?? existing.categoryId;

  if (input.categoryId) {
    const category = await repository.findCategoryById(input.categoryId);
    if (!category) {
      throw new MenuError(404, "NOT_FOUND", "Category not found");
    }
  }

  if (input.subcategoryId !== undefined && input.subcategoryId !== null) {
    const subcategory = await repository.findSubcategoryById(input.subcategoryId);
    if (!subcategory) {
      throw new MenuError(404, "NOT_FOUND", "Subcategory not found");
    }
    if (subcategory.categoryId !== categoryId) {
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

  let modifierGroupIds: string[] | undefined;
  if (input.modifierGroups !== undefined) {
    if (input.modifierGroups.length > 0) {
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

      modifierGroupIds = ids;
    } else {
      modifierGroupIds = [];
    }
  }

  if (input.images) {
    for (const img of input.images) {
      if (!img.url || img.url.trim().length === 0) {
        throw new MenuError(422, "VALIDATION_ERROR", "Each image requires a url");
      }
    }
  }

  const product = await repository.updateProduct(id, {
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.subcategoryId !== undefined ? { subcategoryId: input.subcategoryId } : {}),
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
    ...(input.packagingFeeAmount !== undefined
      ? { packagingFeeAmount: input.packagingFeeAmount }
      : {}),
    ...(input.images !== undefined ? { images: input.images } : {}),
    ...(input.availability !== undefined
      ? {
          isAvailable: input.availability.isAvailable,
          isActive: input.availability.isActive,
        }
      : {}),
    ...(modifierGroupIds !== undefined ? { modifierGroupIds } : {}),
    bundleRules: input.bundleRules,
  });

  return {
    data: product,
    meta: { updatedAt: new Date().toISOString() },
  };
}
