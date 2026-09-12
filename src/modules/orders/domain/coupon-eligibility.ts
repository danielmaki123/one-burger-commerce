/**
 * ¿Se puede usar este cupón? (T9b)
 *
 * Las cuatro comprobaciones que decide esto las necesitan dos caminos: el
 * checkout, para avisarle al cliente antes de confirmar, y la creación del pedido,
 * que es la que manda. Vivían dentro de `create-order`; acá quedan en un solo
 * lugar para que no puedan desincronizarse.
 */

export type CouponEligibility =
  | { usable: true }
  | { usable: false; reason: "inactive" | "expired" | "exhausted" };

/** Mensaje para el cliente, en español y sin jerga de validación. */
export const COUPON_REJECTION_MESSAGES: Record<
  Extract<CouponEligibility, { usable: false }>["reason"],
  string
> = {
  inactive: "Ese código ya no está activo.",
  expired: "Ese código venció.",
  exhausted: "Ese código ya se usó todas las veces que se podía.",
};

/**
 * Normaliza el código que escribe el cliente.
 *
 * Los códigos se guardan en mayúsculas; el cliente escribe como quiere. Sin esto,
 * "b2g1" no encontraba una promo guardada como "B2G1".
 */
export function normalizeCouponCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function resolveCouponEligibility(
  coupon: {
    isActive: boolean;
    expiresAt: string | null;
    usageLimit: number;
    usedCount: number;
  },
  now: Date,
): CouponEligibility {
  if (!coupon.isActive) {
    return { usable: false, reason: "inactive" };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { usable: false, reason: "expired" };
  }

  // En este modelo `usageLimit: 0` es "sin límite", no "cero usos".
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return { usable: false, reason: "exhausted" };
  }

  return { usable: true };
}
