import type { CartItem } from "@/shared/lib/cart";

/**
 * Precios del carrito según el local elegido (fase 4 de T8 / gap del total).
 *
 * El pedido guarda solo ids y **el precio lo resuelve el servidor** con el local elegido.
 * El total que ve el cliente en el checkout se calcula en el navegador, así que hasta
 * ahora usaba los precios del carrito —los del menú que miró, o sea el local por
 * defecto—: con dos locales de precios distintos el cliente podía ver un total y que se
 * le cobre otro.
 *
 * Acá no se reimplementa ninguna regla de precios: se usa el menú que **el servidor ya
 * cotizó para ese local** (`GET /api/menu?locationId=`), donde `basePrice` es el precio
 * que se cobra en ese local y el catálogo ya viene sin lo que ese local no vende.
 *
 * Las líneas cuyo producto no está en ese menú se informan aparte (`missing`) y el
 * checkout frena la confirmación: cambiar el carrito o el total en silencio es peor que
 * decirle al cliente que ese local no lo vende.
 */

export type LocationPricedProduct = {
  basePrice: number;
  /** Delta por opción de modificador, por id (los modificadores son globales, no del local). */
  optionDeltas: Map<string, number>;
};

export type LocationPriceIndex = Map<string, LocationPricedProduct>;

/** Forma mínima del menú público que hace falta para cotizar (categorías y subcategorías). */
export type LocationMenuProduct = {
  id: string;
  basePrice: number;
  modifierGroups?: {
    options?: { id: string; priceDelta?: number | null }[] | null;
  }[] | null;
};

export type LocationMenuCategory = {
  products?: LocationMenuProduct[] | null;
  subcategories?: { products?: LocationMenuProduct[] | null }[] | null;
};

type MenuProductLike = LocationMenuProduct;
type MenuCategoryLike = LocationMenuCategory;

export function buildLocationPriceIndex(
  categories: MenuCategoryLike[] | null | undefined,
): LocationPriceIndex {
  const index: LocationPriceIndex = new Map();

  const addProduct = (product: MenuProductLike) => {
    const optionDeltas = new Map<string, number>();

    for (const group of product.modifierGroups ?? []) {
      for (const option of group.options ?? []) {
        optionDeltas.set(option.id, option.priceDelta ?? 0);
      }
    }

    index.set(product.id, { basePrice: product.basePrice, optionDeltas });
  };

  for (const category of categories ?? []) {
    for (const product of category.products ?? []) addProduct(product);
    for (const subcategory of category.subcategories ?? []) {
      for (const product of subcategory.products ?? []) addProduct(product);
    }
  }

  return index;
}

export type RepricedCart = {
  /** Las líneas con el precio del local elegido. */
  items: CartItem[];
  /** Nombres de los productos que ese local no ofrece (vacío = todo se puede pedir). */
  missing: string[];
};

/**
 * Recalcula las líneas con los precios del local elegido.
 *
 * Un índice vacío (el menú todavía no llegó, o el negocio no tiene locales) deja las
 * líneas como están: no se bloquea nada por una lectura que falta.
 */
export function repriceCartForLocation(
  items: CartItem[],
  index: LocationPriceIndex,
): RepricedCart {
  if (index.size === 0) return { items, missing: [] };

  const missing: string[] = [];

  const repriced = items.map((item) => {
    const product = index.get(item.productId);

    if (!product) {
      missing.push(item.productName);
      return item;
    }

    const modifiersPrice = item.modifierOptionIds.reduce(
      (sum, optionId) => sum + (product.optionDeltas.get(optionId) ?? 0),
      0,
    );
    const unitPrice = product.basePrice + modifiersPrice;

    // El empaque no depende del local: viaja en su propio campo y se suma aparte.
    return { ...item, unitPrice, lineTotal: unitPrice * item.quantity };
  });

  return { items: repriced, missing };
}

/** Mensaje para el cliente cuando el local elegido no vende alguno de sus platos. */
export function describeMissingProducts(locationName: string | null, missing: string[]): string {
  const list = missing.join(", ");
  const where = locationName ? `En ${locationName}` : "En ese local";

  return `${where} no se vende: ${list}. Cambiá de local o quitá esos platos del carrito.`;
}
