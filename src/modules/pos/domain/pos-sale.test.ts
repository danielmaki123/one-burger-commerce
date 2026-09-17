import { describe, expect, it } from "vitest";

import { PosError } from "./pos-errors";
import {
  POS_PAYMENT_METHODS,
  isPosPaymentMethod,
  paymentsTotalInBusinessCurrency,
  recordedPaymentsTotalInBusinessCurrency,
} from "./pos-sale";

/**
 * TASK-303b — la suma de los cobros de una venta.
 *
 * Es la cuenta que se compara contra el total del pedido, así que el caso que importa es el pago en
 * dólares: se convierte con la tasa configurada (no se suma "10" como si fueran 10 córdobas) y sin
 * tasa cargada se rechaza el cobro en vez de cobrar mal.
 */

const business = { businessCurrencyCode: "NIO", usdExchangeRate: 36.5 };

describe("suma de los cobros en la moneda del negocio", () => {
  it("suma un cobro simple", () => {
    expect(
      paymentsTotalInBusinessCurrency({
        ...business,
        payments: [{ method: "cash", currency: "NIO", amount: 130 }],
      }),
    ).toBe(130);
  });

  it("convierte el cobro en dólares antes de sumar", () => {
    expect(
      paymentsTotalInBusinessCurrency({
        ...business,
        payments: [{ method: "cash", currency: "USD", amount: 4 }],
      }),
    ).toBe(146);
  });

  it("un pago mixto suma las dos partes convertidas", () => {
    expect(
      paymentsTotalInBusinessCurrency({
        ...business,
        payments: [
          { method: "cash", currency: "USD", amount: 2 },
          { method: "card", currency: "NIO", amount: 57 },
        ],
      }),
    ).toBe(130);
  });

  it("sin cobros no hay venta", () => {
    expect(() => paymentsTotalInBusinessCurrency({ ...business, payments: [] })).toThrow(PosError);
  });

  it("sin tasa cargada no se puede sumar un cobro en dólares", () => {
    expect(() =>
      paymentsTotalInBusinessCurrency({
        ...business,
        usdExchangeRate: null,
        payments: [{ method: "cash", currency: "USD", amount: 4 }],
      }),
    ).toThrow(PosError);
  });
});

/**
 * Tarea 11 del brief (2026-09-17) — la misma suma, pero sobre los cobros **ya guardados**.
 *
 * La necesita el reintento de un cobro: cuando el servidor reconoce la operación, no registra los cobros
 * otra vez (los duplicaría y el arqueo contaría la venta dos veces), así que el resultado se arma con los
 * que ya están en la base. Un cobro guardado sin moneda (`null`) es de la moneda del negocio.
 */
describe("suma de los cobros ya guardados", () => {
  it("suma los cobros guardados con su moneda", () => {
    expect(
      recordedPaymentsTotalInBusinessCurrency({
        ...business,
        payments: [
          { amount: 100, currency: "NIO" },
          { amount: 4, currency: "USD" },
        ],
      }),
    ).toBe(246);
  });

  it("un cobro sin moneda guardada es de la moneda del negocio", () => {
    expect(
      recordedPaymentsTotalInBusinessCurrency({
        ...business,
        payments: [{ amount: 130, currency: null }],
      }),
    ).toBe(130);
  });

  it("sin cobros guardados el total es cero (no hay nada que sumar)", () => {
    expect(recordedPaymentsTotalInBusinessCurrency({ ...business, payments: [] })).toBe(0);
  });
});

/**
 * Bloque 4 del roadmap del POS (Fase 2) + tareas 9.4/9.5 — **los medios que el mostrador puede cobrar**.
 *
 * Son cuatro y son una sola lista: el mismo cajero los elige en pantalla, viajan en el cobro y son los que
 * se guardan cuando la venta queda en espera. `mixed` está en el vocabulario del pedido —es el **resultado**
 * de partir el cobro entre dos medios— y por eso **no** es una opción del POS: si apareciera en una venta en
 * espera, sería un cobro que la pantalla no puede mostrar ni corregir.
 */
describe("los medios de cobro del POS", () => {
  it("son los cuatro que el cajero puede elegir", () => {
    expect(POS_PAYMENT_METHODS).toEqual(["cash", "card", "transfer", "other"]);
  });

  it("acepta los del mostrador y rechaza el mixto y lo que no es un medio", () => {
    expect(isPosPaymentMethod("cash")).toBe(true);
    expect(isPosPaymentMethod("card")).toBe(true);
    expect(isPosPaymentMethod("transfer")).toBe(true);
    expect(isPosPaymentMethod("other")).toBe(true);

    // `mixed` es un resultado, no una opción; y cualquier otra cosa no es un medio.
    expect(isPosPaymentMethod("mixed")).toBe(false);
    expect(isPosPaymentMethod("bitcoin")).toBe(false);
    expect(isPosPaymentMethod("")).toBe(false);
    expect(isPosPaymentMethod(null)).toBe(false);
  });
});
