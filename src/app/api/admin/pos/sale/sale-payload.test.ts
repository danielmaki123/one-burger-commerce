import { describe, expect, it } from "vitest";

import { PosError } from "@/modules/pos/domain/pos-errors";

import { parsePosSalePayload } from "./sale-payload";

/**
 * Bloque 4 del roadmap del POS (Fase 2) — la forma del cobro del mostrador.
 *
 * El POS cobra efectivo, tarjeta y **transferencia**, y un pedido puede partirse entre medios. Lo que
 * se fija acá: los tres medios entran, `mixed` **no** se elige (se deriva de que haya más de un
 * cobro), la referencia externa viaja al cobro y la moneda se normaliza a mayúsculas.
 */
function body(overrides: Record<string, unknown> = {}) {
  return {
    locationId: "loc_principal",
    customer: { name: "Cliente", whatsapp: "88887777" },
    lines: [{ productId: "prod_1", name: "Taco", unitPrice: 35, quantity: 1 }],
    payments: [{ method: "cash", currency: "nio", amount: 35 }],
    ...overrides,
  };
}

describe("parsePosSalePayload", () => {
  it.each(["cash", "card", "transfer", "other"] as const)(
    "acepta el medio %s",
    (method) => {
      const parsed = parsePosSalePayload(
        body({ payments: [{ method, currency: "nio", amount: 35 }] }),
      );

      expect(parsed.input.payments[0]).toMatchObject({ method, currency: "NIO" });
    },
  );

  it("rechaza `mixed`: es un resultado de partir el cobro, no algo que se elija", () => {
    expect(() =>
      parsePosSalePayload(body({ payments: [{ method: "mixed", currency: "NIO", amount: 35 }] })),
    ).toThrow(PosError);
  });

  it("acepta un cobro partido y lleva la referencia de la transferencia", () => {
    const parsed = parsePosSalePayload(
      body({
        payments: [
          { method: "cash", currency: "NIO", amount: 15 },
          { method: "transfer", currency: "NIO", amount: 20, reference: "TRF-8891" },
        ],
      }),
    );

    expect(parsed.input.payments).toHaveLength(2);
    expect(parsed.input.payments[1]).toMatchObject({ reference: "TRF-8891" });
  });

  it("sin cobros no se cobra nada", () => {
    expect(() => parsePosSalePayload(body({ payments: [] }))).toThrow(PosError);
  });

  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — el cupón viaja con la venta.
   *
   * El código lo escribe el cajero y lo aplica el **servidor** (valida, calcula y consume el uso). La
   * pantalla manda el texto tal cual: normalizarlo es del dominio, que es el que conoce los códigos.
   */
  it("lleva el código de la promo que el cliente trajo", () => {
    const parsed = parsePosSalePayload(body({ couponCode: " bienvenida10 " }));

    expect(parsed.input.couponCode).toBe("BIENVENIDA10");
  });

  it("sin código de promo la venta no lleva cupón", () => {
    expect(parsePosSalePayload(body()).input.couponCode).toBeNull();
  });

  it("un código imposible de guardar se rechaza", () => {
    expect(() => parsePosSalePayload(body({ couponCode: "x".repeat(41) }))).toThrow(PosError);
  });

  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** autorizado.
   *
   * Viaja como forma (porcentaje o monto) y con su motivo: el monto lo calcula el servidor sobre el subtotal
   * que él mismo resolvió. Sin motivo no hay descuento: es plata que sale del arqueo y tiene que estar
   * explicada.
   */
  it("lleva el descuento manual con su motivo", () => {
    const parsed = parsePosSalePayload(
      body({ manualDiscount: { kind: "percentage", value: 10, reason: "Cliente de siempre" } }),
    );

    expect(parsed.input.manualDiscount).toEqual({
      kind: "percentage",
      value: 10,
      reason: "Cliente de siempre",
    });
  });

  it("sin descuento manual la venta no lleva ninguno", () => {
    expect(parsePosSalePayload(body()).input.manualDiscount).toBeNull();
  });

  it("un descuento sin motivo o sin monto se rechaza", () => {
    expect(() =>
      parsePosSalePayload(body({ manualDiscount: { kind: "amount", value: 10, reason: "  " } })),
    ).toThrow(PosError);

    expect(() =>
      parsePosSalePayload(body({ manualDiscount: { kind: "amount", value: 0, reason: "Cortesía" } })),
    ).toThrow(PosError);
  });
});
