import { describe, expect, it } from "vitest";

import {
  PICKUP_PIN_LENGTH,
  formatPickupPin,
  generatePickupPin,
  isValidPickupPin,
} from "@/modules/orders/domain/pickup-pin";

/**
 * T13 — PIN de retiro.
 *
 * El mock muestra "PIN de Retiro 4821 · Díctalo en caja". Es para dictar, no para
 * autorizar: el identificador sigue siendo el número de pedido.
 */
describe("formatPickupPin", () => {
  it("siempre devuelve cuatro dígitos, con ceros a la izquierda", () => {
    expect(formatPickupPin(4821)).toBe("4821");
    expect(formatPickupPin(7)).toBe("0007");
    expect(formatPickupPin(0)).toBe("0000");
  });

  it("no se escapa del rango con valores raros", () => {
    expect(formatPickupPin(12345)).toBe("2345");
    expect(formatPickupPin(-4821)).toBe("4821");
    expect(formatPickupPin(4821.9)).toBe("4821");
  });
});

describe("generatePickupPin", () => {
  it("usa la fuente de azar que le pasan", () => {
    // El azar se inyecta: si no, el test dependería de un número random.
    expect(generatePickupPin(() => 4821)).toBe("4821");
    expect(generatePickupPin(() => 7)).toBe("0007");
    expect(generatePickupPin(() => 0)).toBe("0000");
  });

  it("pide el rango correcto a la fuente de azar", () => {
    const calls: number[] = [];
    generatePickupPin((max) => {
      calls.push(max);
      return 1;
    });

    expect(calls).toEqual([10 ** PICKUP_PIN_LENGTH]);
  });

  it("el resultado siempre es un PIN válido", () => {
    for (const value of [0, 1, 99, 4821, 9999]) {
      expect(isValidPickupPin(generatePickupPin(() => value))).toBe(true);
    }
  });
});

describe("isValidPickupPin", () => {
  it("exige exactamente cuatro dígitos", () => {
    expect(isValidPickupPin("4821")).toBe(true);
    expect(isValidPickupPin("0482")).toBe(true);
    expect(isValidPickupPin("482")).toBe(false);
    expect(isValidPickupPin("48210")).toBe(false);
    expect(isValidPickupPin("48a1")).toBe(false);
    expect(isValidPickupPin(4821)).toBe(false);
    expect(isValidPickupPin(null)).toBe(false);
    expect(isValidPickupPin(undefined)).toBe(false);
  });
});
