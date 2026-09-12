import { pickDefaultLocation } from "@/modules/locations/domain/location-rules";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import type {
  PublicMenuCategory,
  PublicMenuMarketingBlock,
} from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";
import { applyLocationPricing } from "./apply-location-pricing";

type GetPublicMenuInput = {
  category?: string;
  /** Local del que se muestran precios y disponibilidad. Sin dato, el local por defecto. */
  locationId?: string;
  includeUnavailable?: boolean;
};

type GetPublicMenuDependencies = {
  repository: MenuRepository;
  locationRepository: LocationRepository;
};

export async function getPublicMenu(
  input: GetPublicMenuInput,
  { repository, locationRepository }: GetPublicMenuDependencies,
): Promise<{
  categories: PublicMenuCategory[];
  marketingBlocks: PublicMenuMarketingBlock[];
  generatedAt: string;
}> {
  const categories = await repository.getPublicMenu({
    categorySlug: input.category,
    includeUnavailable: input.includeUnavailable,
  });

  // El menú público cobra lo que cobra el local: las excepciones del local se aplican sobre
  // el catálogo del negocio. Sin locales (o sin ninguno activo) se muestran los precios del
  // negocio, que es lo que un negocio de un solo local espera.
  const locations = await locationRepository.listLocations();
  const requested = input.locationId
    ? locations.find((location) => location.id === input.locationId && location.isActive)
    : undefined;
  const location = requested ?? pickDefaultLocation(locations);

  const pricedCategories = location
    ? applyLocationPricing({
        categories,
        rows: await locationRepository.listLocationProducts(location.id),
        locationId: location.id,
        includeUnavailable: Boolean(input.includeUnavailable),
      })
    : categories;

  const marketingBlocks = await repository.listPublicMarketingBlocks({
    now: new Date(),
  });

  return {
    categories: pricedCategories,
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
