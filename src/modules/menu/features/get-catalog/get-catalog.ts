import { pickDefaultLocation } from "@/modules/locations/domain/location-rules";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import { filterCatalogCategories } from "@/modules/menu/domain/catalog-search";
import type {
  CatalogResult,
  CatalogScope,
  MenuMarketingBlockRecord,
  PublicMenuMarketingBlock,
} from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

import { applyLocationPricing } from "./apply-location-pricing";
import { resolveCatalogPolicy } from "./catalog-policy";

/**
 * El **único** caso de uso del catálogo: la carta pública y el mostrador leen por acá.
 *
 * Antes había dos caminos sobre la misma lectura (`getPublicMenu` para la carta y un adaptador del POS
 * que la volvía a leer y la recortaba), con dos shapes distintos. Ahora cambia solo el `scope`: qué se
 * incluye y si se leen los bloques de marketing (`catalog-policy.ts`). El catálogo, el precio del local
 * (T8) y la búsqueda son los mismos para las dos superficies.
 *
 * El resultado lleva `ProductRecord` en los dos alcances: la vista del mostrador (con `requiresOptions`
 * derivado) es una **proyección** del módulo `pos`, no un segundo catálogo.
 */

export type GetCatalogInput = {
  scope: CatalogScope;
  /** El local del que se toman precio y disponibilidad. Sin dato, el local por defecto. */
  locationId?: string;
  /** Búsqueda por nombre de producto **o de su categoría**. */
  query?: string;
  /** Filtro de la carta por slug de categoría (`GET /api/menu?category=`). */
  categorySlug?: string;
  /** Solo el alcance público: `GET /api/menu?includeUnavailable=true` (la carta con el local cerrado). */
  includeUnavailable?: boolean;
};

export type GetCatalogDependencies = {
  repository: MenuRepository;
  locationRepository: LocationRepository;
};

/** El CTA de un bloque de marketing, convertido a un href de la app (o `null` si no navega). */
function toPublicMarketingBlock(block: MenuMarketingBlockRecord): PublicMenuMarketingBlock {
  return {
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
  };
}

export async function getCatalog(
  input: GetCatalogInput,
  { repository, locationRepository }: GetCatalogDependencies,
): Promise<CatalogResult> {
  const policy = resolveCatalogPolicy(input.scope, input);

  const categories = await repository.getPublicMenu({
    categorySlug: input.categorySlug,
    includeUnavailable: policy.includeUnavailable,
  });

  // El catálogo se cobra como lo cobra el local: las excepciones de la sucursal se aplican sobre el
  // catálogo del negocio. Sin locales (o sin ninguno activo) quedan los precios del negocio, que es lo
  // que espera un negocio de un solo local.
  const locations = await locationRepository.listLocations();
  const requested = input.locationId
    ? locations.find((location) => location.id === input.locationId && location.isActive)
    : undefined;
  const location = requested ?? pickDefaultLocation(locations);

  const priced = location
    ? applyLocationPricing({
        categories,
        rows: await locationRepository.listLocationProducts(location.id),
        locationId: location.id,
        includeUnavailable: policy.includeUnavailable,
      })
    : categories;

  const filtered = input.query?.trim()
    ? filterCatalogCategories(priced, input.query)
    : priced;

  const marketingBlocks = policy.loadsMarketingBlocks
    ? (await repository.listPublicMarketingBlocks({ now: new Date() })).map(toPublicMarketingBlock)
    : [];

  return {
    categories: filtered,
    marketingBlocks,
    generatedAt: new Date().toISOString(),
  };
}
