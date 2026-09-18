import { describe, expect, it } from "vitest";

import { composeSaleDiscount, manualDiscountAmount } from "./sale-discount";

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** de una venta de mostrador.
 *
 * Es plata que el cliente deja de pagar porque alguien lo decidió en el momento (una cortesía, un error de
 * la cocina, un cliente de siempre). Se pide de dos formas —un porcentaje o un monto— y siempre con un
 * **motivo escrito**: un descuento sin motivo es plata que desaparece del arqueo sin explicación.
 *
 * Acá vive solo la cuenta y sus límites; quién puede aplicarlo es un permiso (`canDiscountPosSale`) y el
 * asiento del log lo firma la ruta. El monto lo calcula **siempre** el servidor: el cliente manda la forma
 * del descuento, nunca el número.
 */

describe("manualDiscountAmount", () => {
  it("un porcentaje se aplica sobre el subtotal", () => {
    expect(manualDiscountAmount({ discount: { kind: "percentage", value: 10, reason: "Cortesía" }, subtotal: 250 })).toEqual(
      { ok: true, amount: 25 },
    );
  });

  it("un monto fijo entra entero si es más chico que la venta", () => {
    expect(
      manualDiscountAmount({ discount: { kind: "amount", value: 40, reason: "Cortesía" }, subtotal: 250 }),
    ).toEqual({ ok: true, amount: 40 });
  });

  it("un monto más grande que la venta descuenta la venta, no más", () => {
    expect(
      manualDiscountAmount({ discount: { kind: "amount", value: 9999, reason: "Cortesía" }, subtotal: 250 }),
    ).toEqual({ ok: true, amount: 250 });
  });

  it("un descuento vacío o negativo no aplica", () => {
    expect(
      manualDiscountAmount({ discount: { kind: "amount", value: 0, reason: "Cortesía" }, subtotal: 250 }),
    ).toEqual({ ok: false, reason: "invalid-value" });

    expect(
      manualDiscountAmount({ discount: { kind: "percentage", value: -5, reason: "Cortesía" }, subtotal: 250 }),
    ).toEqual({ ok: false, reason: "invalid-value" });
  });

  it("un porcentaje de más del 100 % no aplica (no se regala la venta y encima plata)", () => {
    expect(
      manualDiscountAmount({ discount: { kind: "percentage", value: 120, reason: "Cortesía" }, subtotal: 250 }),
    ).toEqual({ ok: false, reason: "invalid-value" });
  });

  it("sin motivo escrito no hay descuento", () => {
    expect(
      manualDiscountAmount({ discount: { kind: "amount", value: 10, reason: "   " }, subtotal: 250 }),
    ).toEqual({ ok: false, reason: "missing-reason" });
  });

  it("sin venta no hay nada que descontar", () => {
    expect(
      manualDiscountAmount({ discount: { kind: "percentage", value: 10, reason: "Cortesía" }, subtotal: 0 }),
    ).toEqual({ ok: true, amount: 0 });
  });
});

describe("composeSaleDiscount", () => {
  it("suma el cupón y el descuento manual", () => {
    expect(composeSaleDiscount({ couponDiscount: 7, manualDiscount: 25, subtotal: 250 })).toBe(32);
  });

  it("entre los dos nunca descuentan más que la venta", () => {
    expect(composeSaleDiscount({ couponDiscount: 200, manualDiscount: 200, subtotal: 250 })).toBe(250);
  });

  it("sin descuentos el total no cambia", () => {
    expect(composeSaleDiscount({ couponDiscount: 0, manualDiscount: 0, subtotal: 250 })).toBe(0);
  });
});
