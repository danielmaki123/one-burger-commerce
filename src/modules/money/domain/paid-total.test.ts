import { describe, expect, it } from "vitest";

import { paidTotalInBaseCurrency } from "@/modules/money/domain/paid-total";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69c`) — **la suma del cobro partido, en una sola moneda**.
 *
 * Es el último resto del hallazgo. El mostrador del POS suma el total cobrado leyendo `amount` de cada fila
 * **crudo** y lo formatea con el símbolo de la moneda del negocio: con `10 USD + 355 NIO` a tasa 36.5 decía
 * «Cobrado **C$365**» sobre un pedido de C$720 —la suma real—, así que el cajero veía cubierto un pedido que
 * no lo estaba. Viola la invariante 3 del brief («`paidAmount` se expresa siempre en una sola moneda»).
 *
 * La regla es la del servidor (`pos-sale.ts` convierte antes de comparar) y la de la proyección de
 * `payments`: el equivalente sale de `monto × tasa`, redondeado con `roundCurrency`. El `expected` de estos
 * tests está derivado de esa regla, no del helper.
 */
describe("paidTotalInBaseCurrency", () => {
  it("suma plano cuando todo está en la moneda del negocio", () => {
    const total = paidTotalInBaseCurrency({
      payments: [
        { amount: 200, currency: "NIO" },
        { amount: 165, currency: "NIO" },
      ],
      baseCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(total).toBe(365);
  });

  it("convierte la fila en dólares antes de sumar (el caso que mostraba 365 en vez de 720)", () => {
    const total = paidTotalInBaseCurrency({
      payments: [
        { amount: 10, currency: "USD" },
        { amount: 355, currency: "NIO" },
      ],
      baseCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    // 10 × 36.5 + 355 = 365 + 355 = 720.
    expect(total).toBe(720);
  });

  it("una moneda sin tasa no suma como si valiera uno: esa fila queda fuera", () => {
    // El POS sólo ofrece la moneda del negocio y el dólar, así que hoy esto no se alcanza desde la pantalla;
    // la regla existe para que un dato raro no se cuente como si fuera moneda base (ley 7: no se inventa).
    const total = paidTotalInBaseCurrency({
      payments: [
        { amount: 100, currency: "EUR" },
        { amount: 265, currency: "NIO" },
      ],
      baseCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(total).toBe(265);
  });

  it("una fila sin monto válido no rompe la suma", () => {
    const total = paidTotalInBaseCurrency({
      payments: [
        { amount: Number.NaN, currency: "NIO" },
        { amount: 100, currency: "USD" },
      ],
      baseCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(total).toBe(3650);
  });

  it("sin filas el cobrado es cero", () => {
    expect(
      paidTotalInBaseCurrency({ payments: [], baseCurrencyCode: "NIO", usdExchangeRate: 36.5 }),
    ).toBe(0);
  });

  it("una moneda base que no es la del dólar funciona igual", () => {
    const total = paidTotalInBaseCurrency({
      payments: [{ amount: 10, currency: "USD" }],
      baseCurrencyCode: "USD",
      usdExchangeRate: 36.5,
    });

    // Si la moneda del negocio ES el dólar, la fila en dólares no se convierte: vale lo que dice.
    expect(total).toBe(10);
  });
});
