import { describe, expect, it } from "vitest";

import { ShiftError } from "./shift-errors";
import {
  cashCountsTotal,
  cashCountsTotalInBusinessCurrency,
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
