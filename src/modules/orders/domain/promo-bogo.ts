/**
 * Promociones 2×1 (T9).
 *
 * Hoy `Coupon` solo sabe de porcentaje o monto fijo. Una promo tipo "2×1" (o B2G1)
 * necesita tres cosas más: cuántas unidades hay que llevar, cuántas salen gratis y
 * **a qué alcanza** (todo el menú, una categoría, una subcategoría o un producto).
 *
 * El descuento lo calcula el servidor: el cliente manda el **código**, nunca el
 * monto. Este módulo es puro para poder probarlo sin base ni HTTP.
 */

export const BOGO_SCOPE_TYPES = ["all", "category", "subcategory", "product"] as const;

export type BogoScopeType = (typeof BOGO_SCOPE_TYPES)[number];

/** Tope de cordura: una promo de 20×10 no es una promo, es un error de tipeo. */
export const MAX_BOGO_QUANTITY = 10;

export type BogoCouponConfig = {
  buyQuantity?: number | null;
  freeQuantity?: number | null;
  scopeType?: string | null;
  scopeId?: string | null;
};

/** Campo de la promo que puede quedar mal armado. */
export type BogoConfigField = "buyQuantity" | "freeQuantity" | "scopeType" | "scopeId";

/** Error de configuración de la promo, o `null` si está bien armada. */
export type BogoConfigError = { field: BogoConfigField; message: string };

export function validateBogoCouponConfig(coupon: BogoCouponConfig): BogoConfigError | null {
  const buy = coupon.buyQuantity;
  const free = coupon.freeQuantity;

  if (!Number.isInteger(buy) || (buy ?? 0) < 1) {
    return { field: "buyQuantity", message: "La promo necesita cuántas unidades hay que llevar" };
  }
  if (!Number.isInteger(free) || (free ?? 0) < 1) {
    return { field: "freeQuantity", message: "La promo necesita cuántas unidades salen gratis" };
  }
  if ((buy ?? 0) + (free ?? 0) > MAX_BOGO_QUANTITY) {
    return {
      field: "buyQuantity",
      message: `Entre lo que se lleva y lo que sale gratis no puede pasar de ${MAX_BOGO_QUANTITY} unidades`,
    };
  }

  const scopeType = (coupon.scopeType ?? "all") as BogoScopeType;
  if (!BOGO_SCOPE_TYPES.includes(scopeType)) {
    return { field: "scopeType", message: "El alcance de la promo no es válido" };
  }
  if (scopeType !== "all" && !coupon.scopeId) {
    return { field: "scopeId", message: "Elegí a qué alcanza la promo" };
  }

  return null;
}

export type BogoEligibleItem = {
  productId: string;
  categoryId: string;
  subcategoryId: string | null;
  /** Precio unitario ya con modificadores, como lo calcula el servidor. */
  unitPrice: number;
  quantity: number;
};

function isEligible(item: BogoEligibleItem, coupon: BogoCouponConfig): boolean {
  const scopeType = (coupon.scopeType ?? "all") as BogoScopeType;

  if (scopeType === "all") return true;
  if (scopeType === "category") return item.categoryId === coupon.scopeId;
  if (scopeType === "subcategory") return item.subcategoryId === coupon.scopeId;

  return item.productId === coupon.scopeId;
}

/**
 * Descuento de la promo sobre las unidades alcanzadas.
 *
 * Se pagan las unidades **más caras** de cada bloque y salen gratis las más
 * baratas: es el criterio de una promo 2×1 de local (te llevás dos y pagás la más
 * cara), y evita que la promo regale el producto de mayor valor.
 */
export function calculateBogoDiscount({
  items,
  coupon,
}: {
  items: BogoEligibleItem[];
  coupon: BogoCouponConfig;
}): number {
  const buy = Math.trunc(coupon.buyQuantity ?? 0);
  const free = Math.trunc(coupon.freeQuantity ?? 0);
  if (buy < 1 || free < 1) return 0;

  const unitPrices = items
    .filter((item) => isEligible(item, coupon))
    .flatMap((item) => Array.from({ length: Math.max(0, Math.trunc(item.quantity)) }, () => item.unitPrice))
    .sort((a, b) => b - a);

  let paidInBlock = 0;
  let discount = 0;

  for (const price of unitPrices) {
    if (paidInBlock < buy) {
      paidInBlock += 1;
      continue;
    }

    discount += price;
    paidInBlock = 0;
  }

  return Math.round(discount * 100) / 100;
}

/** ¿Alcanza a alguna unidad de este pedido? Se usa para rechazar el código. */
export function hasEligibleBogoUnits({
  items,
  coupon,
}: {
  items: BogoEligibleItem[];
  coupon: BogoCouponConfig;
}): boolean {
  const buy = Math.trunc(coupon.buyQuantity ?? 0);
  const free = Math.trunc(coupon.freeQuantity ?? 0);
  if (buy < 1 || free < 1) return false;

  const eligibleUnits = items
    .filter((item) => isEligible(item, coupon))
    .reduce((sum, item) => sum + Math.max(0, Math.trunc(item.quantity)), 0);

  return eligibleUnits >= buy + free;
}
