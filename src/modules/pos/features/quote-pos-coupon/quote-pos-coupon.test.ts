import { describe, expect, it } from "vitest";

import { quotePosCoupon, type QuotePosCouponDependencies } from "./quote-pos-coupon";

/**
 * Tarea 9.6 del roadmap del POS (Fase 2) — **cotizar un cupón antes de cobrar**.
 *
 * En el mostrador el cajero tiene que decirle al cliente cuánto paga **antes** de que la plata cambie de
 * mano: si el descuento recién apareciera al crear el pedido, cobraría de más (o de menos) y el error se
 * vería con el cliente adelante. La cotización usa el **mismo** cálculo que el alta (`resolveCouponDiscount`)
 * sobre los **mismos** precios que resuelve el servidor, así que el número que se muestra es el que se
 * cobra.
 *
 * Cotizar **no** consume el cupón: los usos se reservan recién cuando el pedido se crea (si no, mirar el
 * descuento quemaría una promo).
 */

const taco = {
  id: "prod_taco",
  name: "Taco de birria",
  basePrice: 35,
  categoryId: "cat_tacos",
  subcategoryId: null,
  isActive: true,
  isAvailable: true,
};

const percentage = {
  id: "coupon_10",
  code: "BIENVENIDA10",
  type: "percentage" as const,
  value: 10,
  isActive: true,
  usageLimit: 100,
  usedCount: 0,
  expiresAt: null,
};

const bogo = {
  id: "coupon_bogo",
  code: "B2G1",
  type: "bogo" as const,
  value: 0,
  isActive: true,
  usageLimit: 0,
  usedCount: 0,
  expiresAt: null,
  buyQuantity: 2,
  freeQuantity: 1,
  scopeType: "all",
  scopeId: null,
};

function deps(
  overrides: Partial<QuotePosCouponDependencies> = {},
): QuotePosCouponDependencies {
  return {
    findCouponByCode: async (code) =>
      [percentage, bogo].find((coupon) => coupon.code === code) ?? null,
    getProduct: async (productId) => (productId === taco.id ? taco : null),
    ...overrides,
  };
}

describe("quotePosCoupon", () => {
  it("cotiza un cupón de porcentaje sobre lo que lleva la venta", async () => {
    const result = await quotePosCoupon(
      { couponCode: "BIENVENIDA10", lines: [{ productId: "prod_taco", quantity: 2 }] },
      deps(),
    );

    expect(result.discount).toBe(7);
    expect(result.coupon.code).toBe("BIENVENIDA10");
    expect(result.subtotal).toBe(70);
  });

  it("el código se lee como lo escribe el cajero (mayúsculas y sin espacios)", async () => {
    const result = await quotePosCoupon(
      { couponCode: "  bienvenida10 ", lines: [{ productId: "prod_taco", quantity: 1 }] },
      deps(),
    );

    expect(result.coupon.code).toBe("BIENVENIDA10");
    expect(result.discount).toBe(3.5);
  });

  it("cotiza una promo por cantidad con las unidades de la venta", async () => {
    const result = await quotePosCoupon(
      { couponCode: "B2G1", lines: [{ productId: "prod_taco", quantity: 3 }] },
      deps(),
    );

    expect(result.discount).toBe(35);
    expect(result.coupon.type).toBe("bogo");
  });

  it("un código que no existe no rompe la pantalla: lo dice", async () => {
    await expect(
      quotePosCoupon({ couponCode: "NOEXISTE", lines: [{ productId: "prod_taco", quantity: 1 }] }, deps()),
    ).rejects.toMatchObject({
      status: 404,
      message: "Ese código no existe.",
      fields: { coupon: "Ese código no existe." },
    });
  });

  it("un cupón que ya no se puede usar dice por qué (la misma regla del checkout)", async () => {
    await expect(
      quotePosCoupon(
        { couponCode: "BIENVENIDA10", lines: [{ productId: "prod_taco", quantity: 1 }] },
        deps({
          findCouponByCode: async () => ({ ...percentage, isActive: false }),
        }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "Ese código ya no está activo." });
  });

  it("una promo que no alcanza a esta venta se rechaza sin consumirla", async () => {
    await expect(
      quotePosCoupon(
        { couponCode: "B2G1", lines: [{ productId: "prod_taco", quantity: 2 }] },
        deps(),
      ),
    ).rejects.toMatchObject({ status: 409, message: "Esa promo no alcanza a esta venta." });
  });

  it("si un producto de la venta ya no está disponible, lo dice con su nombre", async () => {
    await expect(
      quotePosCoupon(
        { couponCode: "BIENVENIDA10", lines: [{ productId: "prod_viejo", quantity: 1 }] },
        deps({ getProduct: async () => null }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("una cantidad que no existe en una venta se rechaza antes de cotizar", async () => {
    await expect(
      quotePosCoupon(
        { couponCode: "BIENVENIDA10", lines: [{ productId: "prod_taco", quantity: 0 }] },
        deps(),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("una cotización sin líneas no tiene nada que descontar", async () => {
    await expect(
      quotePosCoupon({ couponCode: "BIENVENIDA10", lines: [] }, deps()),
    ).rejects.toMatchObject({ status: 422 });
  });
});
