import { describe, expect, it } from "vitest";

import {
  PROMOTION_STATUS_LABELS,
  PROMOTION_TYPE_LABELS,
  createEmptyPromotionForm,
  describePromotionExpiry,
  describePromotionRule,
  describePromotionScope,
  describePromotionUsage,
  promotionFormToInput,
  promotionToForm,
} from "./promotion-helpers";

/**
 * T9c — lo que el admin muestra y lo que manda.
 *
 * Los textos salen de los datos guardados: si la ficha dice "Llevá 3 y pagá 2", el
 * motor tiene que estar cobrando exactamente eso.
 */
const b2g1 = {
  id: "coupon_1",
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
  status: "active" as const,
};

const porcentaje = { ...b2g1, type: "percentage" as const, value: 10 };
const montoFijo = { ...b2g1, type: "fixed_amount" as const, value: 50 };

describe("etiquetas", () => {
  it("cada tipo y cada estado tiene su nombre en español", () => {
    expect(PROMOTION_TYPE_LABELS.percentage).toBe("Porcentaje");
    expect(PROMOTION_TYPE_LABELS.fixed_amount).toBe("Monto fijo");
    expect(PROMOTION_TYPE_LABELS.bogo).toBe("Por cantidad");
    expect(PROMOTION_STATUS_LABELS.active).toBe("Activa");
    expect(PROMOTION_STATUS_LABELS.expired).toBe("Vencida");
    expect(PROMOTION_STATUS_LABELS.exhausted).toBe("Agotada");
    expect(PROMOTION_STATUS_LABELS.inactive).toBe("Inactiva");
  });
});

describe("describePromotionRule", () => {
  it("explica la regla con el tipo de promo", () => {
    expect(describePromotionRule(porcentaje, { symbol: "C$", locale: "es-NI" })).toBe(
      "10 % de descuento",
    );
    expect(describePromotionRule(montoFijo, { symbol: "C$", locale: "es-NI" })).toContain("50");
  });

  it("una promo por cantidad se explica como la lee el cliente", () => {
    // buyQuantity 2 + freeQuantity 1 = llevá 3 y pagá 2 (no "2 unidades, 1 gratis").
    expect(describePromotionRule(b2g1, { symbol: "C$", locale: "es-NI" })).toBe(
      "Llevá 3 y pagá 2",
    );
    expect(
      describePromotionRule({ ...b2g1, buyQuantity: 1, freeQuantity: 1 }, { symbol: "C$", locale: "es-NI" }),
    ).toBe("Llevá 2 y pagá 1");
  });
});

describe("describePromotionScope", () => {
  it("dice a qué alcanza la promo", () => {
    expect(describePromotionScope(b2g1, () => null)).toBe("Todo el menú");
    expect(
      describePromotionScope({ ...b2g1, scopeType: "category", scopeId: "cat_tacos" }, (id) =>
        id === "cat_tacos" ? "Tacos" : null,
      ),
    ).toBe("Categoría: Tacos");
    expect(
      describePromotionScope({ ...b2g1, scopeType: "product", scopeId: "prod_x" }, () => null),
    ).toBe("Plato: sin nombre");
  });
});

describe("describePromotionUsage", () => {
  it("cuenta los usos y dice si hay tope", () => {
    expect(describePromotionUsage(b2g1)).toBe("Sin usos todavía · sin límite");
    expect(describePromotionUsage({ ...b2g1, usedCount: 3, usageLimit: 10 })).toBe(
      "3 de 10 usos",
    );
    expect(describePromotionUsage({ ...b2g1, usedCount: 1, usageLimit: 5 })).toBe("1 de 5 usos");
  });
});

describe("describePromotionExpiry", () => {
  it("la fecha se muestra en la zona del negocio", () => {
    expect(describePromotionExpiry(b2g1, "America/Managua")).toBe("Sin vencimiento");
    // 05:59 UTC del 1 de enero es todavía el 31 de diciembre en Managua.
    expect(
      describePromotionExpiry({ ...b2g1, expiresAt: "2027-01-01T05:59:59.999Z" }, "America/Managua"),
    ).toBe("Vence el 31/12/2026");
  });
});

describe("promotionFormToInput", () => {
  it("una promo por cantidad manda sus unidades y su alcance", () => {
    const input = promotionFormToInput({
      ...createEmptyPromotionForm(),
      code: " b2g1 ",
      type: "bogo",
      buyQuantity: "2",
      freeQuantity: "1",
      scopeType: "category",
      scopeId: "cat_tacos",
    });

    expect(input).toEqual({
      code: "B2G1",
      type: "bogo",
      value: 0,
      isActive: true,
      usageLimit: 0,
      expiresAt: null,
      buyQuantity: 2,
      freeQuantity: 1,
      scopeType: "category",
      scopeId: "cat_tacos",
    });
  });

  it("un porcentaje no manda alcance ni unidades", () => {
    // Si los mandara, la validación del servidor la rechazaría por mentirosa.
    const input = promotionFormToInput({
      ...createEmptyPromotionForm(),
      type: "percentage",
      value: "10",
      buyQuantity: "2",
      freeQuantity: "1",
      scopeType: "product",
      scopeId: "prod_x",
    });

    expect(input.scopeType).toBe("all");
    expect(input.scopeId).toBeNull();
    expect(input.buyQuantity).toBeNull();
    expect(input.freeQuantity).toBeNull();
  });

  it("los campos vacíos llegan vacíos, no en cero", () => {
    // Un 0 silencioso convertiría "me faltó completar" en una promo sin unidades.
    const input = promotionFormToInput({ ...createEmptyPromotionForm(), type: "bogo" });

    expect(input.buyQuantity).toBeNull();
    expect(input.freeQuantity).toBeNull();
    expect(input.expiresAt).toBeNull();
  });
});

describe("promotionToForm", () => {
  it("abre el formulario con lo que está guardado", () => {
    const form = promotionToForm(
      { ...b2g1, usedCount: 2, expiresAt: "2027-01-01T05:59:59.999Z", buyQuantity: 2, freeQuantity: 1 },
      "America/Managua",
    );

    expect(form).toMatchObject({
      code: "B2G1",
      type: "bogo",
      buyQuantity: "2",
      freeQuantity: "1",
      scopeType: "all",
      expiresAt: "2026-12-31",
    });
  });

  it("ida y vuelta sin perder nada", () => {
    const form = promotionToForm(b2g1, "America/Managua");

    expect(promotionFormToInput(form)).toEqual({
      code: "B2G1",
      type: "bogo",
      value: 0,
      isActive: true,
      usageLimit: 0,
      expiresAt: null,
      buyQuantity: 2,
      freeQuantity: 1,
      scopeType: "all",
      scopeId: null,
    });
  });
});
