import { describe, expect, it } from "vitest";

import { PosError } from "./pos-errors";
import { convertPaymentToBusinessCurrency } from "./payment-conversion";

/**
 * TASK-303a — cuánto vale un cobro en la moneda del negocio.
 *
 * El mostrador cobra en córdobas, pero el cliente puede pagar en dólares: la conversión usa el
 * **tipo de cambio configurado** en `/admin/settings` (decisión del owner: una casilla que se ajusta
 * cuando se mueve el mercado, no por venta ni por turno). Si no hay tasa cargada, el pago en otra
 * moneda **se rechaza con el motivo**: inventar un número sería cobrar mal sin que nadie lo sepa.
 *
 * El dólar es la única moneda extranjera que el negocio toma hoy; agregar otra es agregar una tasa y
 * una fila a esta regla, no reescribirla.
 */

const business = { businessCurrencyCode: "NIO" };

describe("conversión de un cobro a la moneda del negocio", () => {
  it("un cobro en la moneda del negocio queda igual, redondeado a dos decimales", () => {
    expect(
      convertPaymentToBusinessCurrency({ ...business, amount: 130, currency: "NIO", usdExchangeRate: null }),
    ).toBe(130);

    expect(
      convertPaymentToBusinessCurrency({
        ...business,
        amount: 130.005,
        currency: "NIO",
        usdExchangeRate: 36.5,
      }),
    ).toBe(130.01);
  });

  it("un cobro en dólares se convierte con el tipo de cambio configurado", () => {
    expect(
      convertPaymentToBusinessCurrency({ ...business, amount: 10, currency: "USD", usdExchangeRate: 36.5 }),
    ).toBe(365);

    expect(
      convertPaymentToBusinessCurrency({ ...business, amount: 10, currency: "USD", usdExchangeRate: 36.579 }),
    ).toBe(365.79);
  });

  it("no le importan mayúsculas ni espacios en la moneda", () => {
    expect(
      convertPaymentToBusinessCurrency({ ...business, amount: 5, currency: " usd ", usdExchangeRate: 36 }),
    ).toBe(180);
  });

  it("sin tipo de cambio cargado rechaza el cobro en dólares con el motivo", () => {
    for (const usdExchangeRate of [null, 0, -3]) {
      try {
        convertPaymentToBusinessCurrency({ ...business, amount: 10, currency: "USD", usdExchangeRate });
        throw new Error("tendría que haber lanzado");
      } catch (error) {
        expect(error).toBeInstanceOf(PosError);
        expect((error as PosError).fields?.usdExchangeRate).toContain("tipo de cambio");
      }
    }
  });

  it("rechaza una moneda que no es la del negocio ni el dólar", () => {
    try {
      convertPaymentToBusinessCurrency({ ...business, amount: 10, currency: "EUR", usdExchangeRate: 36.5 });
      throw new Error("tendría que haber lanzado");
    } catch (error) {
      expect((error as PosError).fields?.currency).toContain("EUR");
    }
  });

  it("rechaza un monto negativo", () => {
    expect(() =>
      convertPaymentToBusinessCurrency({ ...business, amount: -1, currency: "NIO", usdExchangeRate: null }),
    ).toThrow(PosError);
  });
});
