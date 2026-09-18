import { describe, expect, it } from "vitest";

import { describeCouponLabel } from "./coupon-label";

/**
 * El texto de un código aplicado: el mismo en el checkout (T9b) y en el mostrador (tarea 9.6 del roadmap
 * del POS). El **monto** no se calcula acá: eso es del servidor.
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
    // B2G1: 2 pagas + 1 gratis = llevá 3 y pagá 2.
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
