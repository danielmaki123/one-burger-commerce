import { describe, expect, it } from "vitest";

import type { AppliedCoupon } from "@/shared/lib/coupon-label";

import { estimateCouponDiscount } from "./coupon-helpers";

/**
 * T9b — el descuento **estimado** del checkout.
 *
 * El monto definitivo lo calcula el servidor; acá solo se estima lo que se puede saber en el cliente
 * (porcentaje y monto fijo). Para las promos por cantidad no se inventa un número: se dice que se aplica al
 * confirmar. El texto del código aplicado vive en `@/shared/lib/coupon-label` (lo comparte el POS).
 */

const coupon = (overrides: Partial<AppliedCoupon> = {}): AppliedCoupon => ({
  code: "PROMO",
  type: "percentage",
  value: 10,
  buyQuantity: null,
  freeQuantity: null,
  scopeType: "all",
  scopeId: null,
  ...overrides,
});

describe("estimateCouponDiscount", () => {
  it("estima el descuento de porcentaje y de monto fijo", () => {
    expect(estimateCouponDiscount({ coupon: coupon(), subtotal: 380 })).toBe(38);
    expect(
      estimateCouponDiscount({ coupon: coupon({ type: "fixed_amount", value: 50 }), subtotal: 380 }),
    ).toBe(50);
    // El descuento nunca pasa de lo que se está pagando.
    expect(
      estimateCouponDiscount({
        coupon: coupon({ type: "fixed_amount", value: 500 }),
        subtotal: 380,
      }),
    ).toBe(380);
  });

  it("en una promo por cantidad no inventa un monto", () => {
    // Depende de qué unidades entran: eso lo decide el servidor.
    expect(
      estimateCouponDiscount({
        coupon: coupon({ type: "bogo", buyQuantity: 2, freeQuantity: 1 }),
        subtotal: 380,
      }),
    ).toBeNull();
  });
});
