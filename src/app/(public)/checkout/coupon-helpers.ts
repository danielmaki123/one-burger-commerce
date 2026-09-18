import { roundCurrency } from "@/shared/lib/order-totals";
import type { AppliedCoupon } from "@/shared/lib/coupon-label";

/**
 * Descuento **estimado** de un código en el checkout (T9b).
 *
 * El monto definitivo lo calcula el servidor al crear el pedido. Acá solo se estima lo que el cliente
 * puede saber con lo que tiene: porcentaje y monto fijo. Para una promo por cantidad no se inventa un
 * número, porque depende de qué unidades entran.
 *
 * El **texto** del código aplicado vive en `@/shared/lib/coupon-label` (lo comparte el POS, tarea 9.6).
 */

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
