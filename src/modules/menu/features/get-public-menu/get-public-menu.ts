import type {
  PublicMenuCategory,
  PublicMenuMarketingBlock,
} from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type GetPublicMenuInput = {
  category?: string;
  locationId?: string;
  includeUnavailable?: boolean;
};

type GetPublicMenuDependencies = {
  repository: MenuRepository;
};

export async function getPublicMenu(
  input: GetPublicMenuInput,
  { repository }: GetPublicMenuDependencies,
): Promise<{
  categories: PublicMenuCategory[];
  marketingBlocks: PublicMenuMarketingBlock[];
  generatedAt: string;
}> {
  const categories = await repository.getPublicMenu({
    categorySlug: input.category,
    locationId: input.locationId,
    includeUnavailable: input.includeUnavailable,
  });
  const marketingBlocks = await repository.listPublicMarketingBlocks({
    now: new Date(),
  });

  return {
    categories,
    marketingBlocks: marketingBlocks.map((block) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      description: block.description,
      imageUrl: block.imageUrl,
      ctaLabel: block.ctaLabel,
      ctaType: block.ctaType,
      ctaHref:
        block.ctaType === "product" && block.ctaTarget
          ? `/menu/${block.ctaTarget}`
          : block.ctaType === "category" && block.ctaTarget
            ? `/menu?category=${encodeURIComponent(block.ctaTarget)}`
            : block.ctaType === "url"
              ? block.ctaTarget
              : null,
      sortOrder: block.sortOrder,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    })),
    generatedAt: new Date().toISOString(),
  };
}
