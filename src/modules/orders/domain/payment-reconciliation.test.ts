import { describe, expect, it } from "vitest";

import type { PaymentRecord } from "@/modules/orders/domain/order.types";

import {
  isReconciliationMethod,
  RECONCILIATION_METHODS,
  summarizeReconciliation,
} from "./payment-reconciliation";

/**
 * Tarea 10 del brief (2026-09-17) — la **conciliación de tarjeta y transferencia** (11.1/11.2).
 *
 * Lo que se fija acá: el efectivo **no** entra (su cuadre es el arqueo del cajón, no un lote externo), lo
 * que se cobró en dólares se cuenta en **dólares** —no convertido con la tasa de hoy, que es un número que
 * el lote de la terminal nunca tuvo— y lo que no es tarjeta ni transferencia se informa aparte en vez de
 * esconderse o de mezclarse en un total que después no cuadra.
 */

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay_01",
    orderId: "ord_01",
    method: "card",
    amount: 500,
    currency: null,
    changeAmount: 0,
    tip: 0,
    reference: null,
    createdAt: "2026-09-17T15:00:00.000Z",
    ...overrides,
  };
}

describe("isReconciliationMethod", () => {
  it("solo tarjeta y transferencia se concilian contra un lote externo", () => {
    expect(RECONCILIATION_METHODS).toEqual(["card", "transfer"]);
    expect(isReconciliationMethod("card")).toBe(true);
    expect(isReconciliationMethod("transfer")).toBe(true);
    expect(isReconciliationMethod("cash")).toBe(false);
    expect(isReconciliationMethod("mixed")).toBe(false);
    expect(isReconciliationMethod("other")).toBe(false);
  });
});

describe("summarizeReconciliation", () => {
  it("suma tarjeta y transferencia por separado y cuenta los cobros", () => {
    const summary = summarizeReconciliation(
      [
        payment({ id: "pay_01", method: "card", amount: 500 }),
        payment({ id: "pay_02", method: "card", amount: 250.5, tip: 0 }),
        payment({ id: "pay_03", method: "transfer", amount: 1000 }),
        // El efectivo no se concilia acá: su cuadre es el arqueo del cajón.
        payment({ id: "pay_04", method: "cash", amount: 9999 }),
      ],
      { baseCurrencyCode: "NIO" },
    );

    expect(summary.methods).toEqual([
      { method: "card", count: 2, byCurrency: { NIO: 750.5 } },
      { method: "transfer", count: 1, byCurrency: { NIO: 1000 } },
    ]);
    expect(summary.others.count).toBe(0);
  });

  it("un cobro en dólares se cuenta en dólares: la tasa de hoy no estaba en el lote", () => {
    const summary = summarizeReconciliation(
      [
        payment({ id: "pay_01", method: "card", amount: 500 }),
        payment({ id: "pay_02", method: "card", amount: 20, currency: "USD" }),
      ],
      { baseCurrencyCode: "NIO" },
    );

    expect(summary.methods[0]?.byCurrency).toEqual({ NIO: 500, USD: 20 });
  });

  it("sin cobros las dos formas van en cero, no desaparecen", () => {
    const summary = summarizeReconciliation([], { baseCurrencyCode: "NIO" });

    expect(summary.methods).toEqual([
      { method: "card", count: 0, byCurrency: {} },
      { method: "transfer", count: 0, byCurrency: {} },
    ]);
    expect(summary.others.count).toBe(0);
  });

  it("lo que no es tarjeta ni transferencia se informa aparte", () => {
    const summary = summarizeReconciliation(
      [
        payment({ id: "pay_01", method: "mixed", amount: 300 }),
        payment({ id: "pay_02", method: "other", amount: 100, currency: "USD" }),
      ],
      { baseCurrencyCode: "NIO" },
    );

    expect(summary.methods.every((method) => method.count === 0)).toBe(true);
    expect(summary.others).toEqual({ count: 2, byCurrency: { NIO: 300, USD: 100 } });
  });
});
