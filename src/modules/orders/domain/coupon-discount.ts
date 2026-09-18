import type { CouponRecord } from "./order.types";
import {
  calculateBogoDiscount,
  hasEligibleBogoUnits,
  validateBogoCouponConfig,
  type BogoEligibleItem,
} from "./promo-bogo";
import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — **cuánto descuenta un cupón**, en un solo lugar.
 *
 * La cuenta vivía dentro del alta del pedido (`createOrder`), que es donde tiene que **decidirse** —el
 * cliente manda el código, nunca el monto—, pero desde el POS hace falta el **mismo** número *antes* de
 * cobrar: el cajero tiene que decirle al cliente cuánto paga. Con la cuenta escrita dos veces, la
 * cotización del mostrador y el total del pedido podrían diferir justo cuando hay plata en la mano.
 *
 * Acá solo vive la cuenta: porcentaje, monto fijo y las promos por cantidad (2×1) con su alcance. La
 * **elegibilidad** (activo, vencido, usos agotados) es de `coupon-eligibility.ts`, la **consumición** del
 * uso sigue siendo del alta, y el total final sigue saliendo de `order-totals.ts`.
 *
 * Dos reglas que el resultado deja explícitas: un descuento **nunca** pasa del subtotal (un monto fijo más
 * grande que la venta descuenta la venta, no la vuelve negativa) y una promo que no aplica al pedido se
 * rechaza **sin** consumir un uso del cupón.
 */

export type CouponDiscountConfig = Pick<CouponRecord, "type"> & {
  /** Porcentaje o monto fijo. Las promos por cantidad no lo usan (la base guarda 0). */
  value?: number | null;
  buyQuantity?: number | null;
  freeQuantity?: number | null;
  scopeType?: string | null;
  scopeId?: string | null;
};

export type CouponDiscountResult =
  | { ok: true; discount: number }
  | {
      ok: false;
      /** `misconfigured`: la promo está mal armada; `not-applicable`: no alcanza a este pedido. */
      reason: "misconfigured" | "not-applicable";
      /** Qué tiene de malo la promo (solo en `misconfigured`), tal como lo dice el validador. */
      detail?: string;
    };

export function resolveCouponDiscount(input: {
  coupon: CouponDiscountConfig;
  /** Las unidades del pedido, con su categoría y su precio unitario ya resuelto por el servidor. */
  items: BogoEligibleItem[];
  subtotal: number;
}): CouponDiscountResult {
  const { coupon, items, subtotal } = input;

  if (coupon.type === "bogo") {
    const configError = validateBogoCouponConfig(coupon);
    if (configError) {
      return { ok: false, reason: "misconfigured", detail: configError.message };
    }

    if (!hasEligibleBogoUnits({ items, coupon })) {
      return { ok: false, reason: "not-applicable" };
    }

    return {
      ok: true,
      discount: Math.min(subtotal, calculateBogoDiscount({ items, coupon })),
    };
  }

  if (coupon.type === "percentage") {
    return { ok: true, discount: roundCurrency((subtotal * (coupon.value ?? 0)) / 100) };
  }

  return { ok: true, discount: Math.min(coupon.value ?? 0, subtotal) };
}
