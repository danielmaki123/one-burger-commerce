import { describe, expect, it } from "vitest";

import {
  normalizeCouponCode,
  resolveCouponEligibility,
} from "@/modules/orders/domain/coupon-eligibility";

/**
 * T9(b) — por qué un código no se puede usar.
 *
 * Las mismas cuatro comprobaciones las necesitan dos caminos: el checkout (para
 * avisarle al cliente antes de confirmar) y la creación del pedido (que es la que
 * manda). Vivían dentro de `create-order`; acá quedan en un solo lugar.
 */
const base = {
  isActive: true,
  expiresAt: null,
  usageLimit: 10,
  usedCount: 0,
};

const now = new Date("2026-09-12T12:00:00.000Z");

describe("normalizeCouponCode", () => {
  it("acepta el código como lo escriba el cliente", () => {
    expect(normalizeCouponCode("b2g1")).toBe("B2G1");
    expect(normalizeCouponCode("  B2g1 ")).toBe("B2G1");
    expect(normalizeCouponCode(null)).toBe("");
    expect(normalizeCouponCode(undefined)).toBe("");
  });
});

describe("resolveCouponEligibility", () => {
  it("un cupón activo y vigente se puede usar", () => {
    expect(resolveCouponEligibility(base, now)).toEqual({ usable: true });
  });

  it("un cupón apagado no se puede usar", () => {
    expect(resolveCouponEligibility({ ...base, isActive: false }, now)).toEqual({
      usable: false,
      reason: "inactive",
    });
  });

  it("un cupón vencido no se puede usar", () => {
    expect(
      resolveCouponEligibility({ ...base, expiresAt: "2026-09-11T12:00:00.000Z" }, now),
    ).toEqual({ usable: false, reason: "expired" });
    // El día del vencimiento todavía sirve.
    expect(
      resolveCouponEligibility({ ...base, expiresAt: "2026-09-12T23:00:00.000Z" }, now),
    ).toEqual({ usable: true });
  });

  it("un cupón agotado no se puede usar", () => {
    expect(resolveCouponEligibility({ ...base, usageLimit: 3, usedCount: 3 }, now)).toEqual({
      usable: false,
      reason: "exhausted",
    });
  });

  it("sin límite de uso (0) siempre queda disponible", () => {
    // `usageLimit: 0` es "sin límite" en el modelo actual, no "cero usos".
    expect(resolveCouponEligibility({ ...base, usageLimit: 0, usedCount: 99 }, now)).toEqual({
      usable: true,
    });
  });
});
