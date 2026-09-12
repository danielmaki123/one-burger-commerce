import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Cómo se muestra un código aplicado (T9b).
 *
 * El **monto definitivo lo calcula el servidor** al crear el pedido. Acá solo se
 * estima lo que el cliente puede saber con lo que tiene: porcentaje y monto fijo.
 * Para una promo por cantidad no se inventa un número, porque depende de qué
 * unidades entran.
 */
export type AppliedCoupon = {
  code: string;
  type: "percentage" | "fixed_amount" | "bogo";
  value: number;
  buyQuantity: number | null;
  freeQuantity: number | null;
  scopeType: string;
  scopeId: string | null;
};

export function describeCouponLabel(coupon: AppliedCoupon, currencySymbol: string): string {
  if (coupon.type === "percentage") {
    return `${coupon.value} % de descuento`;
  }

  if (coupon.type === "fixed_amount") {
    return `${currencySymbol}${coupon.value.toFixed(2)} de descuento`;
  }

  // `buyQuantity` es lo que se paga y `freeQuantity` lo que sale gratis: un
  // bloque de B2G1 (2 pagas + 1 gratis) se dice "llevá 3 y pagá 2".
  const buy = coupon.buyQuantity ?? 0;
  const free = coupon.freeQuantity ?? 0;

  return `Llevá ${buy + free} y pagá ${buy}`;
}

/** Descuento estimado, o `null` si solo el servidor puede saberlo. */
export function estimateCouponDiscount({
  coupon,
  subtotal,
}: {
  coupon: AppliedCoupon;
  subtotal: number;
}): number | null {
  if (coupon.type === "percentage") {
    return roundCurrency((subtotal * coupon.value) / 100);
  }

  if (coupon.type === "fixed_amount") {
    return roundCurrency(Math.min(coupon.value, subtotal));
  }

  return null;
}
