import { describe, expect, it } from "vitest";

import {
  calculateOrderChange,
  formatOrderChangeLabel,
  validatePaidWithAmount,
} from "@/modules/orders/domain/payment-change";

/**
 * T12 — vuelto del efectivo.
 *
 * El mock muestra "Pagas C$1.000 · Vuelto" en su historial. Acá el dato entra por
 * el checkout (opcional), se guarda con el pedido y el cambio se deriva: sirve en
 * la caja, no en la cocina.
 */
describe("validatePaidWithAmount", () => {
  it("sin monto declarado no hay nada que validar", () => {
    expect(
      validatePaidWithAmount({ paidWithAmount: null, total: 480, paymentMethod: "cash" }),
    ).toBeNull();
    expect(
      validatePaidWithAmount({ paidWithAmount: undefined, total: 480, paymentMethod: "cash" }),
    ).toBeNull();
  });

  it("acepta un monto que alcanza para pagar el total", () => {
    expect(
      validatePaidWithAmount({ paidWithAmount: 500, total: 480, paymentMethod: "cash" }),
    ).toBeNull();
    expect(
      validatePaidWithAmount({ paidWithAmount: 480, total: 480, paymentMethod: "cash" }),
    ).toBeNull();
  });

  it("rechaza un monto que no alcanza, uno en cero y uno negativo", () => {
    expect(
      validatePaidWithAmount({ paidWithAmount: 400, total: 480, paymentMethod: "cash" }),
    ).toContain("alcanzar");
    expect(
      validatePaidWithAmount({ paidWithAmount: 0, total: 480, paymentMethod: "cash" }),
    ).toContain("mayor que cero");
    expect(
      validatePaidWithAmount({ paidWithAmount: -100, total: 480, paymentMethod: "cash" }),
    ).toContain("mayor que cero");
  });

  it("rechaza un monto absurdo: un cero de más no puede llegar a la caja", () => {
    // El tope es relativo al total, no un número fijo: la moneda la elige el negocio.
    expect(
      validatePaidWithAmount({ paidWithAmount: 480000, total: 480, paymentMethod: "cash" }),
    ).toContain("demasiado alto");
    expect(
      validatePaidWithAmount({ paidWithAmount: 9600, total: 480, paymentMethod: "cash" }),
    ).toBeNull();
  });

  it("no acepta vuelto cuando el pago es con tarjeta", () => {
    expect(
      validatePaidWithAmount({ paidWithAmount: 500, total: 480, paymentMethod: "card" }),
    ).toContain("efectivo");
  });
});

describe("calculateOrderChange", () => {
  it("sin monto no hay cambio que calcular", () => {
    expect(calculateOrderChange({ paidWithAmount: null, total: 480 })).toBeNull();
    expect(calculateOrderChange({ paidWithAmount: undefined, total: 480 })).toBeNull();
  });

  it("calcula el vuelto y no devuelve negativos", () => {
    expect(calculateOrderChange({ paidWithAmount: 500, total: 480 })).toBe(20);
    expect(calculateOrderChange({ paidWithAmount: 480, total: 480 })).toBe(0);
    expect(calculateOrderChange({ paidWithAmount: 400, total: 480 })).toBe(0);
  });

  it("redondea a dos decimales como el resto de los importes", () => {
    // 500.005 no es representable exacto en binario: se usan valores sin ambigüedad.
    expect(calculateOrderChange({ paidWithAmount: 500.006, total: 480 })).toBe(20.01);
    expect(calculateOrderChange({ paidWithAmount: 500.004, total: 480 })).toBe(20);
  });
});

describe("formatOrderChangeLabel", () => {
  const format = (value: number) => `C$${value.toFixed(2)}`;

  it("dice cuánto hay que devolver y avisa cuando no hay vuelto", () => {
    expect(formatOrderChangeLabel(20, format)).toBe("Cambio C$20.00");
    expect(formatOrderChangeLabel(0, format)).toBe("Sin cambio (paga con lo justo)");
    expect(formatOrderChangeLabel(null, format)).toBeNull();
  });
});
