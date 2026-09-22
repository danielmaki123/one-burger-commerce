import { describe, expect, it } from "vitest";

import {
  bankClosesTotalByCurrency,
  bankClosesTotalInBusinessCurrency,
  nonCashTotalsByCurrency,
  validateShiftBankCloses,
  type ShiftBankCloseInput,
} from "./shift-bank-close";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el cuadre por banco.
 *
 * El otro lado del 11.1: el sistema ya sabe cuánto cobró con tarjeta y transferencia en la ventana del
 * turno; acá se valida y se suma **lo que declara cada banco** (el lote de la terminal), por moneda.
 */

const bankConfig = { currencies: ["NIO", "USD"], bankIds: ["bac", "banpro"] };

function close(overrides: Partial<ShiftBankCloseInput> = {}): ShiftBankCloseInput {
  return {
    bankId: "bac",
    declaredAmount: 1000,
    currency: "NIO",
    lote: "0012",
    terminalLabel: "Terminal 1",
    notes: null,
    ...overrides,
  };
}

describe("validateShiftBankCloses", () => {
  it("acepta un cierre de banco bien formado y no devuelve errores", () => {
    expect(validateShiftBankCloses([close()], bankConfig)).toEqual({});
  });

  it("exige el banco: sin banco no se sabe contra quién se cuadra", () => {
    const fields = validateShiftBankCloses([close({ bankId: "  " })], bankConfig);

    expect(fields["bankCloses.0.bankId"]).toBe("Elegí el banco.");
  });

  it("rechaza un banco que no liquida en este local", () => {
    // Los dientes de la asignación por sucursal: la pantalla solo ofrece los bancos de la sucursal y el
    // servidor rechaza el que llegue armado a mano.
    const fields = validateShiftBankCloses([close({ bankId: "lafise" })], bankConfig);

    expect(fields["bankCloses.0.bankId"]).toBe("Ese banco no liquida en este local.");
  });

  it("rechaza un monto negativo o que no es un número", () => {
    const negative = validateShiftBankCloses([close({ declaredAmount: -1 })], bankConfig);
    const nan = validateShiftBankCloses([close({ declaredAmount: Number.NaN })], bankConfig);

    expect(negative["bankCloses.0.declaredAmount"]).toBe("Tiene que ser 0 o más.");
    expect(nan["bankCloses.0.declaredAmount"]).toBe("Tiene que ser 0 o más.");
  });

  it("rechaza una moneda que el local no trabaja", () => {
    const fields = validateShiftBankCloses(
      [close({ currency: "EUR" })],
      { currencies: ["NIO"], bankIds: ["bac"] },
    );

    expect(fields["bankCloses.0.currency"]).toBe("Este local no liquida en EUR.");
  });

  it("rechaza dos filas del mismo banco en la misma moneda", () => {
    // Dos filas iguales serían dos veces el mismo lote: el índice único de la base las rechazaría con un
    // error de servidor, así que la validación lo dice antes y con palabras.
    const fields = validateShiftBankCloses([close(), close()], bankConfig);

    expect(fields["bankCloses.1.bankId"]).toBe("Ese banco ya está declarado en esa moneda.");
  });

  it("el mismo banco puede liquidar córdobas y dólares en el mismo turno", () => {
    const fields = validateShiftBankCloses(
      [close(), close({ currency: "USD", declaredAmount: 20 })],
      bankConfig,
    );

    expect(fields).toEqual({});
  });

  it("acota los textos libres y no deja pasar un lote kilométrico", () => {
    const fields = validateShiftBankCloses(
      [close({ lote: "9".repeat(41), terminalLabel: "T".repeat(41), notes: "n".repeat(201) })],
      bankConfig,
    );

    expect(fields["bankCloses.0.lote"]).toBe("Máximo 40 caracteres.");
    expect(fields["bankCloses.0.terminalLabel"]).toBe("Máximo 40 caracteres.");
    expect(fields["bankCloses.0.notes"]).toBe("Máximo 200 caracteres.");
  });

  it("sin catálogo cargado no acepta ningún banco (una base recién creada no inventa bancos)", () => {
    const fields = validateShiftBankCloses([close()], { currencies: ["NIO"], bankIds: [] });

    expect(fields["bankCloses.0.bankId"]).toBe("Ese banco no liquida en este local.");
  });
});

describe("bankClosesTotalByCurrency", () => {
  it("suma lo declarado por moneda, sin convertir nada", () => {
    const totals = bankClosesTotalByCurrency([
      close({ declaredAmount: 1000 }),
      close({ bankId: "banpro", declaredAmount: 250.5 }),
      close({ currency: "USD", declaredAmount: 20 }),
    ]);

    expect(totals).toEqual({ NIO: 1250.5, USD: 20 });
  });

  it("sin filas no hay monedas (y no un cero inventado)", () => {
    expect(bankClosesTotalByCurrency([])).toEqual({});
  });
});

describe("bankClosesTotalInBusinessCurrency", () => {
  it("convierte los dólares con la tasa del negocio", () => {
    const total = bankClosesTotalInBusinessCurrency({
      closes: [close({ declaredAmount: 1000 }), close({ currency: "USD", declaredAmount: 20 })],
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(total).toBe(1730);
  });

  it("sin tasa cargada rechaza el cierre con dólares en vez de inventar un número", () => {
    expect(() =>
      bankClosesTotalInBusinessCurrency({
        closes: [close({ currency: "USD", declaredAmount: 20 })],
        businessCurrencyCode: "NIO",
        usdExchangeRate: null,
      }),
    ).toThrow(/tipo de cambio/);
  });
});

describe("nonCashTotalsByCurrency", () => {
  it("suma tarjeta y transferencia por moneda, y deja el efectivo afuera", () => {
    const totals = nonCashTotalsByCurrency({
      payments: [
        { method: "card", currency: "NIO", amount: 500, tip: 0, changeAmount: 0 },
        { method: "transfer", currency: "NIO", amount: 250, tip: 0, changeAmount: 0 },
        { method: "card", currency: "USD", amount: 20, tip: 0, changeAmount: 0 },
        { method: "cash", currency: "NIO", amount: 999, tip: 0, changeAmount: 0 },
        { method: "other", currency: "NIO", amount: 100, tip: 0, changeAmount: 0 },
      ],
      businessCurrencyCode: "NIO",
    });

    expect(totals).toEqual({ NIO: 750, USD: 20 });
  });

  it("una moneda vacía se cuenta en la del negocio (los cobros viejos no la guardaban)", () => {
    const totals = nonCashTotalsByCurrency({
      payments: [{ method: "card", currency: null, amount: 400, tip: 0, changeAmount: 0 }],
      businessCurrencyCode: "NIO",
    });

    expect(totals).toEqual({ NIO: 400 });
  });
});
