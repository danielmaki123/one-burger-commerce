import type { CartItem } from "@/shared/lib/cart";

/**
 * Agregar un producto al carrito sin abrir su pantalla.
 *
 * Lo usan la grilla de la home y la del menú: en las dos, el "+" del mock
 * (24 px, sin efecto) es un botón real cuando el producto no obliga a elegir
 * nada, y cuando sí lo obliga la tarjeta entera lleva a elegir.
 */
export type QuickAddProduct = {
  id: string;
  name: string;
  basePrice: number;
  packagingFeeAmount?: number | null;
  images?: { url: string; alt: string | null; isPrimary?: boolean }[] | null;
  modifierGroups?: {
    isRequired?: boolean | null;
    minSelections?: number | null;
    options?: { priceDelta?: number | null; isActive?: boolean | null }[] | null;
  }[] | null;
};

export function canQuickAddProduct(product: Pick<QuickAddProduct, "modifierGroups">): boolean {
  return !(product.modifierGroups ?? []).some((group) => {
    const activeOptions = (group.options ?? []).filter(
      (option) => option.isActive !== false,
    );
    if (activeOptions.length === 0) return false;

    return Boolean(group.isRequired) || (group.minSelections ?? 0) > 0;
  });
}

/** Línea del carrito: sin modificadores, con el empaque que cobra el producto. */
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
    lineTotal: unitPrice * quantity + packagingUnitAmount * quantity,
  };
}
