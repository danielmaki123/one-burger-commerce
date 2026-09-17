import { describe, expect, it } from "vitest";

import { ShiftError } from "./shift-errors";
import {
  cashCountsTotal,
  cashCountsTotalInBusinessCurrency,
  cashMovementsTotalByCurrency,
  cashPaymentsTotalInBusinessCurrency,
  countedCurrencies,
  expectedCashByCurrency,
  validateShiftCashCounts,
} from "./shift-cash";

/**
 * TASK-305 — el conteo de la caja y lo que el arqueo espera.
 *
 * Es plata: lo que se prueba acá es que el esperado **no** cuente la tarjeta (no está en el cajón),
 * que convierta los dólares (no que los sume como si fueran córdobas) y que descuente el vuelto (que
 * salió del cajón). Los tres eran agujeros del arqueo de TASK-104.
 */

const NIO = (denomination: number, quantity: number) => ({ currency: "NIO", denomination, quantity });
const USD = (denomination: number, quantity: number) => ({ currency: "USD", denomination, quantity });

describe("conteo de la caja", () => {
  it("valida moneda, billete y cantidad", () => {
    expect(validateShiftCashCounts([NIO(100, 3), USD(20, 1)])).toEqual({});

    expect(validateShiftCashCounts([{ currency: "EUR", denomination: 10, quantity: 1 }])).toEqual({
      "counts.0.currency": expect.stringContaining("EUR"),
    });
    expect(validateShiftCashCounts([NIO(25, 1)])).toEqual({
      "counts.0.denomination": expect.stringContaining("no existe"),
    });
    expect(validateShiftCashCounts([NIO(100, 1.5)])).toEqual({
      "counts.0.quantity": expect.stringContaining("entero"),
    });
    // Contar el mismo billete dos veces es un error de carga, no un dato.
    expect(validateShiftCashCounts([NIO(100, 1), NIO(100, 2)])).toEqual({
      "counts.1.denomination": expect.stringContaining("ya está contado"),
    });
  });

  it("suma por moneda y no mezcla", () => {
    const counts = [NIO(100, 3), NIO(50, 2), USD(20, 4)];

    expect(cashCountsTotal(counts, "NIO")).toBe(400);
    expect(cashCountsTotal(counts, "USD")).toBe(80);
    expect(countedCurrencies(counts)).toEqual(["NIO", "USD"]);
  });

  it("convierte el conteo a la moneda del negocio", () => {
    expect(
      cashCountsTotalInBusinessCurrency({
        counts: [NIO(100, 3), USD(10, 2)],
        businessCurrencyCode: "NIO",
        usdExchangeRate: 36.5,
      }),
    ).toBe(1030);
  });

  it("sin tipo de cambio no se puede cerrar una caja con dólares", () => {
    expect(() =>
      cashCountsTotalInBusinessCurrency({
        counts: [USD(10, 1)],
        businessCurrencyCode: "NIO",
        usdExchangeRate: null,
      }),
    ).toThrow(ShiftError);
  });

  it("suma el efectivo del turno con su propina y su vuelto", () => {
    // El filtro por método de pago vive en el caso de uso (`close-shift`): acá solo llega efectivo.
    const expected = expectedCashByCurrency({
      openingCounts: [NIO(100, 5)],
      businessCurrencyCode: "NIO",
      cashPayments: [{ currency: "NIO", amount: 200, tip: 20, changeAmount: 0 }],
    });

    expect(expected.NIO).toBe(720);
  });

  it("cuenta los dólares en dólares y descuenta el vuelto", () => {
    const expected = expectedCashByCurrency({
      openingCounts: [NIO(100, 5), USD(20, 2)],
      businessCurrencyCode: "NIO",
      cashPayments: [
        // Un cobro en dólares sin vuelto: entran 3 dólares al cajón.
        { currency: "USD", amount: 3, tip: 0, changeAmount: 0 },
        // Un cobro en córdobas con vuelto: entran 100 y salen 60.
        { currency: "NIO", amount: 100, tip: 0, changeAmount: 60 },
      ],
    });

    expect(expected.NIO).toBe(540);
    expect(expected.USD).toBe(43);
  });
});

/**
 * Bloque 1.2 del roadmap del POS (Fase 2) — cuánto entró **en efectivo** en el turno.
 *
 * No es el total vendido: es la parte que pasó por el cajón (monto + propina − vuelto), convertida a
 * la moneda del negocio. Se congela al cerrar junto con el esperado, porque el arqueo de un turno
 * cerrado no puede cambiar después.
 */
describe("efectivo del turno en moneda del negocio", () => {
  it("suma monto y propina y descuenta el vuelto", () => {
    const total = cashPaymentsTotalInBusinessCurrency({
      cashPayments: [
        { currency: "NIO", amount: 1000, tip: 50, changeAmount: 100 },
        { currency: "NIO", amount: 500, tip: 0, changeAmount: 0 },
      ],
      businessCurrencyCode: "NIO",
      usdExchangeRate: null,
    });

    expect(total).toBe(1450);
  });

  it("convierte los cobros en dólares con la tasa cargada", () => {
    const total = cashPaymentsTotalInBusinessCurrency({
      cashPayments: [{ currency: "USD", amount: 10, tip: 0, changeAmount: 0 }],
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(total).toBe(365);
  });

  it("sin cobros devuelve cero, no NaN", () => {
    expect(
      cashPaymentsTotalInBusinessCurrency({
        cashPayments: [],
        businessCurrencyCode: "NIO",
        usdExchangeRate: null,
      }),
    ).toBe(0);
  });
});

/**
 * Bloque 2 del roadmap del POS (Fase 2) — la plata que entra o sale del cajón sin ser un cobro.
 *
 * Hasta acá el esperado era `fondo + efectivo − vueltos`: si alguien sacaba C$500 para el proveedor,
 * el cierre marcaba faltante sin forma de explicarlo. Un **retiro resta** del esperado y un **ingreso
 * suma**, cada uno en **su** moneda (un retiro de US$20 no puede restar 20 córdobas).
 */
describe("movimientos de caja en el esperado", () => {
  it("el retiro resta y el ingreso suma, por moneda", () => {
    const movements = cashMovementsTotalByCurrency({
      movements: [
        { kind: "withdrawal", currency: "NIO", amount: 500 },
        { kind: "withdrawal", currency: "USD", amount: 20 },
        { kind: "deposit", currency: "NIO", amount: 150 },
      ],
    });

    expect(movements).toEqual({ NIO: -350, USD: -20 });
  });

  it("sin movimientos devuelve un objeto vacío, no ceros", () => {
    expect(cashMovementsTotalByCurrency({ movements: [] })).toEqual({});
  });

  it("una moneda que no estaba en el conteo entra igual", () => {
    const movements = cashMovementsTotalByCurrency({
      movements: [{ kind: "deposit", currency: "USD", amount: 10 }],
    });

    expect(movements).toEqual({ USD: 10 });
  });
});
