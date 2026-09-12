import { describe, expect, it } from "vitest";

import {
  PROMOTION_CODE_PATTERN,
  normalizePromotionCode,
  validatePromotionInput,
} from "@/modules/orders/domain/promotion-rules";

/**
 * T9c — reglas de una promo, en un solo lugar.
 *
 * El admin las usa para avisar antes de guardar y el caso de uso para rechazar de
 * verdad. Los mensajes son para el owner, no para un log.
 */
const base = {
  code: "B2G1",
  type: "bogo" as const,
  value: 0,
  isActive: true,
  usageLimit: 0,
  expiresAt: null,
  buyQuantity: 2,
  freeQuantity: 1,
  scopeType: "all",
  scopeId: null,
};

describe("normalizePromotionCode", () => {
  it("deja el código como se guarda: mayúsculas y sin espacios", () => {
    expect(normalizePromotionCode(" b2g1 ")).toBe("B2G1");
    expect(normalizePromotionCode("tacos-2x1")).toBe("TACOS-2X1");
  });
});

describe("validatePromotionInput", () => {
  it("acepta una promo bien armada", () => {
    expect(validatePromotionInput(base)).toEqual({});
    expect(
      validatePromotionInput({ ...base, type: "percentage", value: 10, buyQuantity: null, freeQuantity: null }),
    ).toEqual({});
    expect(
      validatePromotionInput({ ...base, type: "fixed_amount", value: 50, buyQuantity: null, freeQuantity: null }),
    ).toEqual({});
  });

  it("exige un código con formato de código", () => {
    expect(validatePromotionInput({ ...base, code: "" }).code).toContain("código");
    expect(validatePromotionInput({ ...base, code: "AB" }).code).toContain("3");
    expect(validatePromotionInput({ ...base, code: "CON ESPACIO" }).code).toBeDefined();
    expect(validatePromotionInput({ ...base, code: "PROMO!" }).code).toBeDefined();
    expect(PROMOTION_CODE_PATTERN.test("B2G1")).toBe(true);
    expect(PROMOTION_CODE_PATTERN.test("VERANO-2026")).toBe(true);
  });

  it("cada tipo tiene su valor obligatorio", () => {
    expect(validatePromotionInput({ ...base, type: "percentage", value: 0 }).value).toContain("1");
    expect(validatePromotionInput({ ...base, type: "percentage", value: 101 }).value).toContain("100");
    expect(validatePromotionInput({ ...base, type: "percentage", value: 7.5 }).value).toBeDefined();
    expect(validatePromotionInput({ ...base, type: "fixed_amount", value: 0 }).value).toBeDefined();
  });

  it("una promo por cantidad no puede quedar mal armada", () => {
    // Reusa las reglas del motor: unidades que se llevan y que salen gratis.
    expect(validatePromotionInput({ ...base, buyQuantity: null }).buyQuantity).toContain("llevar");
    expect(validatePromotionInput({ ...base, freeQuantity: 0 }).freeQuantity).toContain("gratis");
  });

  it("el alcance solo tiene sentido en una promo por cantidad", () => {
    // Un porcentaje con alcance mentiría: hoy el descuento no mira las categorías.
    expect(
      validatePromotionInput({
        ...base,
        type: "percentage",
        value: 10,
        scopeType: "category",
        scopeId: "cat_tacos",
      }).scopeType,
    ).toContain("cantidad");

    expect(
      validatePromotionInput({ ...base, scopeType: "category", scopeId: null }).scopeId,
    ).toContain("alcanza");
  });

  it("el límite de uso y el vencimiento se validan", () => {
    expect(validatePromotionInput({ ...base, usageLimit: -1 }).usageLimit).toBeDefined();
    expect(validatePromotionInput({ ...base, usageLimit: 5 }).usageLimit).toBeUndefined();
    // 0 es "sin límite", no un error.
    expect(validatePromotionInput({ ...base, usageLimit: 0 }).usageLimit).toBeUndefined();
    expect(validatePromotionInput({ ...base, expiresAt: "el viernes" }).expiresAt).toBeDefined();
    expect(validatePromotionInput({ ...base, expiresAt: "2026-12-31T00:00:00.000Z" }).expiresAt).toBeUndefined();
  });
});
