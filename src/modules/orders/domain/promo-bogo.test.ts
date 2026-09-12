import { describe, expect, it } from "vitest";

import {
  MAX_BOGO_QUANTITY,
  calculateBogoDiscount,
  hasEligibleBogoUnits,
  validateBogoCouponConfig,
} from "@/modules/orders/domain/promo-bogo";

/**
 * T9 — promociones por cantidad.
 *
 * El mock muestra "PROMO B2G1" (llevá 3, pagá 2): un bloque son **3 unidades**.
 * El motor es general — sirve igual para un 2×1 (llevá 1, pagá 1) — y el descuento
 * lo calcula el servidor desde el código que manda el cliente.
 */
const helper = (
  productId: string,
  categoryId: string,
  subcategoryId: string | null,
  unitPrice: number,
  quantity = 1,
) => ({ productId, categoryId, subcategoryId, unitPrice, quantity });

const taco = helper("prod-taco", "cat-tacos", "sub-especiales", 35);
const agua = helper("prod-agua", "cat-bebidas", "sub-frias", 25);

/** B2G1: llevá 2, pagá 1. */
const b2g1 = { buyQuantity: 2, freeQuantity: 1, scopeType: "all", scopeId: null };

describe("validateBogoCouponConfig", () => {
  it("acepta una promo bien armada", () => {
    expect(validateBogoCouponConfig(b2g1)).toBeNull();
    expect(
      validateBogoCouponConfig({
        buyQuantity: 2,
        freeQuantity: 1,
        scopeType: "category",
        scopeId: "cat-tacos",
      }),
    ).toBeNull();
  });

  it("exige cuántas unidades se llevan y cuántas salen gratis", () => {
    expect(validateBogoCouponConfig({ ...b2g1, buyQuantity: null })).toContain("llevar");
    expect(validateBogoCouponConfig({ ...b2g1, buyQuantity: 0 })).toContain("llevar");
    expect(validateBogoCouponConfig({ ...b2g1, freeQuantity: null })).toContain("gratis");
    expect(validateBogoCouponConfig({ ...b2g1, freeQuantity: 0 })).toContain("gratis");
  });

  it("no acepta una promo absurda por un error de tipeo", () => {
    expect(
      validateBogoCouponConfig({ buyQuantity: MAX_BOGO_QUANTITY, freeQuantity: 1 }),
    ).toContain("no puede pasar");
  });

  it("si la promo alcanza a algo, tiene que decir a qué", () => {
    expect(validateBogoCouponConfig({ ...b2g1, scopeType: "category", scopeId: null })).toContain(
      "alcanza",
    );
    expect(validateBogoCouponConfig({ ...b2g1, scopeType: "planeta" })).toContain("alcance");
  });
});

describe("calculateBogoDiscount", () => {
  it("con tres unidades, la más barata sale gratis", () => {
    // Se pagan las más caras del bloque: el descuento es la más barata.
    const items = [
      helper("prod-a", "cat-tacos", null, 100),
      helper("prod-b", "cat-tacos", null, 60),
      helper("prod-c", "cat-tacos", null, 35),
    ];

    expect(calculateBogoDiscount({ items, coupon: b2g1 })).toBe(35);
  });

  it("un bloque incompleto no descuenta nada", () => {
    expect(calculateBogoDiscount({ items: [{ ...taco, quantity: 1 }], coupon: b2g1 })).toBe(0);
    expect(calculateBogoDiscount({ items: [{ ...taco, quantity: 2 }], coupon: b2g1 })).toBe(0);
    expect(calculateBogoDiscount({ items: [], coupon: b2g1 })).toBe(0);
  });

  it("repite la promo por cada bloque completo", () => {
    // Bloques de 3: 3 unidades → 1 gratis; 4 → 1; 6 → 2.
    expect(calculateBogoDiscount({ items: [{ ...taco, quantity: 3 }], coupon: b2g1 })).toBe(35);
    expect(calculateBogoDiscount({ items: [{ ...taco, quantity: 4 }], coupon: b2g1 })).toBe(35);
    expect(calculateBogoDiscount({ items: [{ ...taco, quantity: 6 }], coupon: b2g1 })).toBe(70);
  });

  it("solo mira las unidades alcanzadas por el alcance", () => {
    const tresTacos = { ...taco, quantity: 3 };
    const tresAguas = { ...agua, quantity: 3 };

    // Por categoría: las bebidas no entran aunque haya tres.
    expect(
      calculateBogoDiscount({
        items: [tresTacos, tresAguas],
        coupon: { ...b2g1, scopeType: "category", scopeId: "cat-tacos" },
      }),
    ).toBe(35);
    expect(
      calculateBogoDiscount({
        items: [tresTacos, tresAguas],
        coupon: { ...b2g1, scopeType: "subcategory", scopeId: "sub-frias" },
      }),
    ).toBe(25);
    expect(
      calculateBogoDiscount({
        items: [tresTacos, tresAguas],
        coupon: { ...b2g1, scopeType: "product", scopeId: "prod-agua" },
      }),
    ).toBe(25);
  });

  it("el alcance que no toca ninguna unidad no descuenta nada", () => {
    expect(
      calculateBogoDiscount({
        items: [{ ...taco, quantity: 3 }],
        coupon: { ...b2g1, scopeType: "category", scopeId: "cat-postres" },
      }),
    ).toBe(0);
  });

  it("sirve igual para un 2×1 (llevá 1, pagá 1)", () => {
    const dosPorUno = { buyQuantity: 1, freeQuantity: 1, scopeType: "all", scopeId: null };

    expect(
      calculateBogoDiscount({ items: [{ ...taco, quantity: 2 }], coupon: dosPorUno }),
    ).toBe(35);
    expect(
      calculateBogoDiscount({ items: [{ ...taco, quantity: 4 }], coupon: dosPorUno }),
    ).toBe(70);
  });

  it("suma bloques aunque las unidades alcancen cosas distintas", () => {
    // 3 unidades alcanzadas con precios distintos: paga 100 y 60, la de 35 es gratis.
    const dosPorUno = { buyQuantity: 1, freeQuantity: 1, scopeType: "all", scopeId: null };

    expect(
      calculateBogoDiscount({
        items: [
          helper("prod-a", "cat-tacos", null, 100),
          helper("prod-b", "cat-tacos", null, 60),
        ],
        coupon: dosPorUno,
      }),
    ).toBe(60);
  });

  it("una promo mal configurada no descuenta nada", () => {
    expect(
      calculateBogoDiscount({ items: [taco], coupon: { buyQuantity: 0, freeQuantity: 0 } }),
    ).toBe(0);
  });
});

describe("hasEligibleBogoUnits", () => {
  it("necesita al menos un bloque completo de unidades alcanzadas", () => {
    expect(hasEligibleBogoUnits({ items: [{ ...taco, quantity: 3 }], coupon: b2g1 })).toBe(true);
    expect(hasEligibleBogoUnits({ items: [{ ...taco, quantity: 2 }], coupon: b2g1 })).toBe(false);
    expect(
      hasEligibleBogoUnits({
        items: [{ ...taco, quantity: 5 }],
        coupon: { ...b2g1, scopeType: "category", scopeId: "cat-postres" },
      }),
    ).toBe(false);
  });

  it("una promo mal configurada nunca alcanza a nada", () => {
    expect(
      hasEligibleBogoUnits({ items: [{ ...taco, quantity: 5 }], coupon: { buyQuantity: 0, freeQuantity: 0 } }),
    ).toBe(false);
  });
});
