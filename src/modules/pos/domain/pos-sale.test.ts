import { describe, expect, it } from "vitest";

import { PosError } from "./pos-errors";
import { paymentsTotalInBusinessCurrency } from "./pos-sale";

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
