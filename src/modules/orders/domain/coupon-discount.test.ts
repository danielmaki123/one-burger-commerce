import { describe, expect, it } from "vitest";

import { resolveCouponDiscount } from "./coupon-discount";
import type { BogoEligibleItem } from "./promo-bogo";

/**
 * El descuento de un cupón, en **un solo lugar**.
 *
 * Estaba dentro del alta del pedido (`createOrder`), que es donde tiene que decidirse —el cliente manda el
 * código, nunca el monto—, pero desde el POS (tarea 9.6) hace falta el **mismo** número antes de cobrar:
 * el cajero tiene que saber cuánto pedirle al cliente. Con la cuenta duplicada, la cotización y el cobro
 * podrían dar distinto y el cajero cobraría mal.
 *
 * Acá solo vive la cuenta: porcentaje, monto fijo y las promos por cantidad (2×1) con su alcance. La
 * elegibilidad del cupón (activo, vencido, usos agotados) es de `coupon-eligibility.ts` y la consumición
 * del uso sigue siendo del alta.
 */

const item = (overrides: Partial<BogoEligibleItem> = {}): BogoEligibleItem => ({
  productId: "prod_taco",
  categoryId: "cat_tacos",
  subcategoryId: null,
  unitPrice: 35,
  quantity: 2,
  ...overrides,
});

describe("resolveCouponDiscount", () => {
  it("un porcentaje se aplica sobre el subtotal", () => {
    const result = resolveCouponDiscount({
      coupon: { type: "percentage", value: 10 },
      items: [item()],
      subtotal: 380,
    });

    expect(result).toEqual({ ok: true, discount: 38 });
  });

  it("un monto fijo se aplica entero si entra en el subtotal", () => {
    const result = resolveCouponDiscount({
      coupon: { type: "fixed_amount", value: 50 },
      items: [item()],
      subtotal: 380,
    });

    expect(result).toEqual({ ok: true, discount: 50 });
  });

  it("un monto fijo más grande que la venta descuenta el subtotal, nunca más", () => {
    const result = resolveCouponDiscount({
      coupon: { type: "fixed_amount", value: 500 },
      items: [item()],
      subtotal: 380,
    });

    expect(result).toEqual({ ok: true, discount: 380 });
  });

  it("una promo por cantidad (2×1) descuenta las unidades que corresponden", () => {
    const result = resolveCouponDiscount({
      coupon: { type: "bogo", buyQuantity: 2, freeQuantity: 1 },
      items: [item({ quantity: 3 })],
      subtotal: 105,
    });

    expect(result).toEqual({ ok: true, discount: 35 });
  });

  it("una promo por cantidad que no alcanza las unidades no aplica", () => {
    const result = resolveCouponDiscount({
      coupon: { type: "bogo", buyQuantity: 2, freeQuantity: 1 },
      items: [item({ quantity: 2 })],
      subtotal: 70,
    });

    expect(result).toEqual({ ok: false, reason: "not-applicable" });
  });

  it("una promo mal armada no descuenta nada y lo dice con su motivo", () => {
    const result = resolveCouponDiscount({
      coupon: { type: "bogo", buyQuantity: 0, freeQuantity: 1 },
      items: [item({ quantity: 3 })],
      subtotal: 105,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.reason).toBe("misconfigured");
    expect(result.detail).toContain("unidades");
  });

  it("sin unidades en la venta el descuento es cero (no hay nada que descontar)", () => {
    expect(
      resolveCouponDiscount({ coupon: { type: "percentage", value: 10 }, items: [], subtotal: 0 }),
    ).toEqual({ ok: true, discount: 0 });
  });
});
