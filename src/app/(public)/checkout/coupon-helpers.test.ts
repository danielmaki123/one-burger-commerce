import { describe, expect, it } from "vitest";

import { describeCouponLabel, estimateCouponDiscount } from "./coupon-helpers";

/**
 * T9b — cómo se muestra el código aplicado en el checkout.
 *
 * El monto definitivo lo calcula el servidor; acá solo se estima lo que se puede
 * saber en el cliente (porcentaje y monto fijo). Para las promos por cantidad no se
 * inventa un número: se dice que se aplica al confirmar.
 */
const coupon = (overrides: Partial<Parameters<typeof describeCouponLabel>[0]> = {}) => ({
  code: "PROMO",
  type: "percentage" as const,
  value: 10,
  buyQuantity: null,
  freeQuantity: null,
  scopeType: "all",
  scopeId: null,
  ...overrides,
});

describe("describeCouponLabel", () => {
  it("describe el descuento por porcentaje y por monto fijo", () => {
    expect(describeCouponLabel(coupon(), "C$")).toBe("10 % de descuento");
    expect(describeCouponLabel(coupon({ type: "fixed_amount", value: 50 }), "C$")).toBe(
      "C$50.00 de descuento",
    );
  });

  it("describe la promo por cantidad con su bloque completo", () => {
    // B2G1 del mock: 2 pagas + 1 gratis = llevá 3 y pagá 2.
    expect(
      describeCouponLabel(coupon({ type: "bogo", buyQuantity: 2, freeQuantity: 1 }), "C$"),
    ).toBe("Llevá 3 y pagá 2");

    // Un 2×1: 1 paga + 1 gratis = llevá 2 y pagá 1.
    expect(
      describeCouponLabel(
        coupon({ type: "bogo", buyQuantity: 1, freeQuantity: 1, scopeType: "category" }),
        "C$",
      ),
    ).toBe("Llevá 2 y pagá 1");
  });
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
