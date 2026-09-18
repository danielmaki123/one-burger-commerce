/**
 * Cómo se muestra un código de promo aplicado.
 *
 * Vivía en el checkout (`(public)/checkout/coupon-helpers.ts`) y desde la tarea 9.6 del roadmap del POS lo
 * usa también el mostrador: el cajero tiene que poder decirle al cliente **qué** promo se aplicó, no solo
 * cuánto baja. El texto es el mismo en los dos lados a propósito —un código que se lee distinto según la
 * pantalla es un código que el cliente no reconoce—, así que vive en un solo lugar.
 *
 * El **monto** no se calcula acá: en el checkout se estima lo que el cliente puede saber (y para las promos
 * por cantidad no se inventa un número) y en el POS lo dice el servidor al cotizar.
 */

export type AppliedCoupon = {
  code: string;
  type: "percentage" | "fixed_amount" | "bogo";
  value: number;
  buyQuantity: number | null;
  freeQuantity: number | null;
  scopeType: string | null;
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
