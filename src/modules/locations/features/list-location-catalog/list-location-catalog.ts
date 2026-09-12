import { LocationError } from "@/modules/locations/domain/location-errors";
import {
  catalogProductIds,
  resolveLocationPrice,
  summarizeLocationCatalog,
} from "@/modules/locations/domain/location-product-rules";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

/**
 * T8 fase 4 — el catálogo que ve el admin para un local.
 *
 * No hay copia del menú: se listan los productos del negocio y, al lado, la **excepción**
 * del local (precio propio, agotado, no lo vendo). El precio que se muestra es el que
 * cobraría el servidor, resuelto con la regla pura.
 */
export type LocationCatalogItem = {
  productId: string;
  name: string;
  categoryId: string;
  /** Precio del negocio, para poder mostrar de dónde sale el del local. */
  basePrice: number;
  /** Precio que cobra este local (el base si no tiene precio propio). */
  price: number;
  hasPriceOverride: boolean;
  isAvailable: boolean;
  isSold: boolean;
};

type ListLocationCatalogDependencies = {
  locationRepository: LocationRepository;
  menuRepository: MenuRepository;
};

export async function listLocationCatalog(
  locationId: string,
  { locationRepository, menuRepository }: ListLocationCatalogDependencies,
): Promise<{
  data: LocationCatalogItem[];
  meta: {
    /** El local, para que la pantalla no tenga que pedirlo de nuevo. */
    location: { id: string; name: string };
    total: number;
    sold: number;
    unavailable: number;
    overridden: number;
  };
}> {
  const location = await locationRepository.findLocationById(locationId);
  if (!location) {
    throw new LocationError(404, "NOT_FOUND", "Location not found");
  }

  const products = await menuRepository.listProducts({});
  const rows = await locationRepository.listLocationProducts(locationId);
  const productIds = products.map((product) => product.id);
  const soldIds = new Set(catalogProductIds({ productIds, rows, locationId }));
  const rowByProduct = new Map(rows.map((row) => [row.productId, row]));

  const data: LocationCatalogItem[] = products.map((product) => {
    const row = rowByProduct.get(product.id);
    const isSold = soldIds.has(product.id);

    return {
      productId: product.id,
      name: product.name,
      categoryId: product.categoryId,
      basePrice: product.basePrice,
      price: resolveLocationPrice({ basePrice: product.basePrice, priceOverride: row?.priceOverride }),
      hasPriceOverride: (row?.priceOverride ?? null) !== null,
      // Un producto agotado en el negocio también lo está en el local.
      isAvailable:
        product.availability.isAvailable && (isSold ? (row?.isAvailable ?? true) : true),
      isSold,
    };
  });

  return {
    data,
    meta: {
      location: { id: location.id, name: location.name },
      ...summarizeLocationCatalog({ productIds, rows, locationId }),
    },
  };
}
