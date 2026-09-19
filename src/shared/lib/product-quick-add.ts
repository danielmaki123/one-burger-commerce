import type { CartItem } from "@/shared/lib/cart";

/**
 * Agregar un producto al carrito sin abrir su pantalla.
 *
 * Lo usan la grilla de la home y la del menú: en las dos, el "+" del mock
 * (24 px, sin efecto) es un botón real cuando el producto no obliga a elegir
 * nada, y cuando sí lo obliga la tarjeta entera lleva a elegir.
 *
 * **La regla de "¿obliga a elegir?" no vive acá** (A-37, 2026-09-19): es
 * `canQuickAddProduct` del dominio del menú (`modules/menu/domain/modifier-selection`), la misma que
 * valida el alta del pedido y la que marca `requiresOptions` en el catálogo del mostrador. Acá queda
 * solo armar la línea.
 */
export type QuickAddProduct = {
  id: string;
  name: string;
  basePrice: number;
  packagingFeeAmount?: number | null;
  images?: { url: string; alt: string | null; isPrimary?: boolean }[] | null;
};

/**
 * Línea del carrito: sin modificadores, con el empaque que cobra el producto.
 *
 * `lineTotal` es el precio de los **productos** (precio × cantidad), sin el empaque: el
 * empaque se suma una sola vez aparte, con `packagingTotalAmount`, que es lo que hace el
 * servidor en `createOrder` y lo que hacen el carrito y el checkout al mostrar el total.
 * Sumarlo acá también lo contaba dos veces y el cliente veía un total más alto que el que
 * se le cobraba (bug real con los productos que tienen empaque).
 */
export function buildQuickAddCartItem(
  product: QuickAddProduct,
  quantity = 1,
): CartItem {
  const packagingUnitAmount = product.packagingFeeAmount ?? 0;
  const primaryImage = product.images?.find((image) => image.isPrimary) ?? product.images?.[0];
  const unitPrice = product.basePrice;

  return {
    productId: product.id,
    productName: product.name,
    imageUrl: primaryImage?.url,
    imageAlt: primaryImage?.alt ?? product.name,
    quantity,
    unitPrice,
    packagingUnitAmount,
    packagingTotalAmount: packagingUnitAmount * quantity,
    modifierOptionIds: [],
    modifiers: [],
    lineTotal: unitPrice * quantity,
  };
}
