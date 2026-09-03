import { MenuError } from "@/modules/menu/domain/menu-errors";
import type {
  MenuMarketingBlockCtaType,
  MenuMarketingBlockRecord,
  MenuMarketingBlockType,
} from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type MarketingBlockDraft = {
  type: MenuMarketingBlockType;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaType: MenuMarketingBlockCtaType;
  ctaTarget?: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

function normalizeNullableText(value?: string | null): string | null {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isValidUrlTarget(value: string): boolean {
  if (value.startsWith("/")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function validateMarketingBlockInput(
  input: MarketingBlockDraft,
  repository: MenuRepository,
): Promise<{
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
}> {
  const title = input.title.trim();
  if (title.length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { title: "Required" });
  }

  if (input.sortOrder < 0) {
    throw new MenuError(422, "VALIDATION_ERROR", "sortOrder must be >= 0", {
      sortOrder: "Must be >= 0",
    });
  }

  const startsAt = input.startsAt ?? null;
  const endsAt = input.endsAt ?? null;
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new MenuError(422, "VALIDATION_ERROR", "endsAt cannot be before startsAt", {
      endsAt: "Must be after startsAt",
    });
  }

  const description = normalizeNullableText(input.description);
  const imageUrl = normalizeNullableText(input.imageUrl);
  let ctaLabel = normalizeNullableText(input.ctaLabel);
  let ctaTarget = normalizeNullableText(input.ctaTarget);

  if (input.ctaType === "none") {
    ctaLabel = null;
    ctaTarget = null;
  } else {
    if (!ctaLabel) {
      throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { ctaLabel: "Required" });
    }
    if (!ctaTarget) {
      throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { ctaTarget: "Required" });
    }

    if (input.ctaType === "product") {
      const product = await repository.getProductById(ctaTarget);
      if (!product || !product.availability.isActive) {
        throw new MenuError(404, "NOT_FOUND", "Product not found", {
          ctaTarget: "Invalid product",
        });
      }
    }

    if (input.ctaType === "category") {
      const category = await repository.findCategoryBySlug(ctaTarget);
      if (!category || !category.isActive) {
        throw new MenuError(404, "NOT_FOUND", "Category not found", {
          ctaTarget: "Invalid category slug",
        });
      }
    }

    if (input.ctaType === "url" && !isValidUrlTarget(ctaTarget)) {
      throw new MenuError(422, "VALIDATION_ERROR", "Invalid URL target", {
        ctaTarget: "Must be absolute http/https URL or relative path",
      });
    }
  }

  return {
    type: input.type,
    title,
    description,
    imageUrl,
    ctaLabel,
    ctaType: input.ctaType,
    ctaTarget,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    startsAt,
    endsAt,
  };
}
