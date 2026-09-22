import { describe, expect, it } from "vitest";

import { toCashCountConfig } from "./cash-count-config";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — la config del conteo, en una función pura.
 *
 * Es la regla que hace que `usdEnabled` y las denominaciones **tengan dientes**: la pantalla dibuja el
 * conteo con esto, y el servidor valida el payload con esto. Tres cosas que fija:
 *
 * 1. **La moneda del negocio siempre está** (hoy `NIO`); el dólar solo si la sucursal lo maneja.
 * 2. **Solo las denominaciones activas** entran al conteo: desactivar un billete lo saca de la grilla y
 *    del payload aceptado, sin borrar la fila (la historia de los cierres viejos no se toca).
 * 3. **Si una moneda no tiene filas de config**, se usan los defaults del módulo: una base recién creada
 *    (o una sucursal sin tocar) no puede quedarse sin poder contar.
 */

const denominaciones = [
  { currency: "NIO", value: 1000, isActive: true, sortOrder: 0 },
  { currency: "NIO", value: 500, isActive: false, sortOrder: 1 },
  { currency: "USD", value: 100, isActive: true, sortOrder: 0 },
];

describe("toCashCountConfig", () => {
  it("sin dólares habilitados, la sucursal cuenta solo en la moneda del negocio", () => {
    const config = toCashCountConfig({
      businessCurrencyCode: "NIO",
      usdEnabled: false,
      denominations: denominaciones,
    });

    expect(config.currencies).toEqual(["NIO"]);
    // La moneda apagada no viaja: ni en la grilla ni en la validación.
    expect(config.denominations.USD).toBeUndefined();
  });

  it("con dólares habilitados, la moneda del negocio va primero y el dólar suma", () => {
    const config = toCashCountConfig({
      businessCurrencyCode: "NIO",
      usdEnabled: true,
      denominations: denominaciones,
    });

    expect(config.currencies).toEqual(["NIO", "USD"]);
    expect(config.denominations.USD).toEqual([100]);
  });

  it("solo las denominaciones activas, de mayor a menor", () => {
    const config = toCashCountConfig({
      businessCurrencyCode: "NIO",
      usdEnabled: false,
      denominations: [
        { currency: "NIO", value: 100, isActive: true, sortOrder: 1 },
        { currency: "NIO", value: 500, isActive: false, sortOrder: 0 },
        { currency: "NIO", value: 1000, isActive: true, sortOrder: 2 },
      ],
    });

    expect(config.denominations.NIO).toEqual([1000, 100]);
  });

  it("una moneda sin filas de config cae a los defaults del módulo", () => {
    const config = toCashCountConfig({
      businessCurrencyCode: "NIO",
      usdEnabled: false,
      denominations: [],
    });

    expect(config.currencies).toEqual(["NIO"]);
    expect(config.denominations.NIO).toEqual([1000, 500, 200, 100, 50, 20, 10, 5, 1]);
  });

  it("una moneda con todas sus filas apagadas no queda sin grilla: cae a los defaults", () => {
    const config = toCashCountConfig({
      businessCurrencyCode: "NIO",
      usdEnabled: true,
      denominations: [
        { currency: "NIO", value: 1000, isActive: false, sortOrder: 0 },
        { currency: "USD", value: 100, isActive: false, sortOrder: 0 },
      ],
    });

    expect(config.denominations.NIO).toEqual([1000, 500, 200, 100, 50, 20, 10, 5, 1]);
    expect(config.denominations.USD).toEqual([100, 50, 20, 10, 5, 2, 1]);
  });
});
