import { describe, expect, it } from "vitest";

import { baseOnlyMoneyContext, type MoneyContext } from "@/modules/money/domain/money-context";

import { buildPaymentSnapshotFor } from "./payment-snapshot";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`, `D-024`) — **el snapshot se construye desde el
 * contexto monetario**, que es lo que permite que el POS y el cobro de un pedido compartan la misma ley sin
 * que ninguno de los dos lea la configuración por su cuenta.
 *
 * Lo que se fija acá:
 *
 * 1. un cobro **en la moneda base** se congela con tasa `1` y equivalente igual al monto: la igualdad tiene
 *    que quedar **escrita**, no deducida después de la configuración de ese día;
 * 2. un cobro en otra moneda se congela con **su** tasa y su equivalente;
 * 3. una moneda **sin tasa vigente** o **fuera del catálogo** no se firma: el cobro falla en vez de inventar
 *    un equivalente (`D-020`).
 *
 * El `expected` de los montos sale de una regla explícita del negocio (`monto × tasa`, redondeado al
 * centavo), no de la función bajo prueba.
 */
describe("buildPaymentSnapshotFor", () => {
  const context: MoneyContext = {
    baseCurrencyCode: "NIO",
    locale: "es-NI",
    rates: { USD: 36.5, EUR: 40 },
    knownCurrencyCodes: ["NIO", "USD", "EUR"],
  };

  it("congela la igualdad con la moneda base en vez de deducirla después", () => {
    const snapshot = buildPaymentSnapshotFor(
      { amount: 365, currency: "NIO", methodKind: "cash" },
      context,
    );

    expect(snapshot).toEqual({
      amount: 365,
      currency: "NIO",
      baseCurrencyCode: "NIO",
      exchangeRate: 1,
      baseAmount: 365,
      methodKind: "cash",
    });
  });

  it("congela la tasa aplicada y el equivalente de una moneda extranjera", () => {
    // 10 × 36.5 = 365. La regla está escrita acá a propósito: no se reusa el helper de producción.
    const snapshot = buildPaymentSnapshotFor(
      { amount: 10, currency: "usd", methodKind: "card" },
      context,
    );

    expect(snapshot).toEqual({
      amount: 10,
      currency: "USD",
      baseCurrencyCode: "NIO",
      exchangeRate: 36.5,
      baseAmount: 365,
      methodKind: "card",
    });
  });

  it("redondea el equivalente al centavo, con el redondeo de `money`", () => {
    // 3 × 36.5 = 109.5; 0.33 × 40 = 13.2. El caso con centavos: 0.37 × 40 = 14.8.
    expect(
      buildPaymentSnapshotFor({ amount: 0.37, currency: "EUR", methodKind: "cash" }, context).baseAmount,
    ).toBe(14.8);
  });

  it("no firma un cobro de una moneda que el catálogo no conoce", () => {
    expect(() =>
      buildPaymentSnapshotFor({ amount: 10, currency: "JPY", methodKind: "cash" }, context),
    ).toThrowError(/JPY/);
  });

  it("no firma un cobro de una moneda conocida sin tasa vigente", () => {
    const withoutRate: MoneyContext = { ...context, rates: { EUR: 40 } };

    expect(() =>
      buildPaymentSnapshotFor({ amount: 10, currency: "USD", methodKind: "cash" }, withoutRate),
    ).toThrowError(/tasa/i);
  });

  it("en un negocio que solo cobra su moneda base igual congela el snapshot", () => {
    // El caso que el POS productivo rompía: `baseOnlyMoneyContext` no tiene tasas y el cobro en la base
    // tiene que firmarse igual, con su igualdad explícita.
    const snapshot = buildPaymentSnapshotFor(
      { amount: 80, currency: "NIO", methodKind: "cash" },
      baseOnlyMoneyContext("NIO"),
    );

    expect(snapshot.baseAmount).toBe(80);
    expect(snapshot.exchangeRate).toBe(1);
  });
});
