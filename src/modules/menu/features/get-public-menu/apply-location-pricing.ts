import { resolveLocationPrice } from "@/modules/locations/domain/location-product-rules";
import type { LocationProductRecord } from "@/modules/locations/domain/location.types";
import type { PublicMenuCategory } from "@/modules/menu/domain/menu.types";

/**
 * T8 fase 5 — el menú público con los precios del local.
 *
 * El local guarda **excepciones**, así que acá se aplican al menú que ya existe:
 *  - el precio que ve el cliente es el del local (el del negocio si no hay excepción);
 *  - lo que el local no vende, no se muestra;
 *  - lo agotado en el local tampoco, salvo que se pidan los no disponibles (el menú cuando el
 *    local está cerrado los sigue necesitando).
 *
 * El `basePrice` del menú público pasa a ser **el precio que se cobra en ese local**, que es
 * lo que el sitio necesita para armar "desde C$X" con los modificadores. El admin sigue
 * viendo el precio del negocio aparte, en su pantalla.
 */
export function applyLocationPricing({
  categories,
  rows,
  locationId,
  includeUnavailable,
}: {
  categories: PublicMenuCategory[];
  rows: LocationProductRecord[];
  locationId: string;
  includeUnavailable: boolean;
}): PublicMenuCategory[] {
  const byProduct = new Map(
    rows
      .filter((row) => row.locationId === locationId)
      .map((row) => [row.productId, row] as const),
  );

  const priceProducts = (products: PublicMenuCategory["products"]) =>
    products.flatMap((product) => {
      const row = byProduct.get(product.id);

      if (row && !row.isActive) return [];
      if (row && !row.isAvailable && !includeUnavailable) return [];

      return [
        {
          ...product,
          basePrice: resolveLocationPrice({
            basePrice: product.basePrice,
            priceOverride: row?.priceOverride,
          }),
        },
      ];
    });

  return categories.map((category) => ({
    ...category,
    products: priceProducts(category.products),
    // Una subcategoría que se queda sin productos no se dibuja: un encabezado vacío se ve
    // como un error de la carta.
    subcategories: category.subcategories
      .map((subcategory) => ({ ...subcategory, products: priceProducts(subcategory.products) }))
      .filter((subcategory) => subcategory.products.length > 0),
  }));
}
