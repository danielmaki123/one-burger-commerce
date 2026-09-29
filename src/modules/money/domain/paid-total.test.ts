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
      rates: { USD: 36.5 },
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
      rates: { USD: 36.5 },
    });

    // 10 × 36.5 + 355 = 365 + 355 = 720.
    expect(total).toBe(720);
  });

  it("una moneda sin tasa no suma como si valiera uno: esa fila queda fuera", () => {
    // La pantalla ofrece las monedas aceptadas, así que una moneda **sin tasa vigente** puede llegar acá (el
    // dueño la activó pero no registró la tasa). Queda fuera: el sistema dice «no se sabe», no inventa un
    // equivalente (ley 7).
    const total = paidTotalInBaseCurrency({
      payments: [
        { amount: 100, currency: "EUR" },
        { amount: 265, currency: "NIO" },
      ],
      baseCurrencyCode: "NIO",
      rates: { USD: 36.5 },
    });

    expect(total).toBe(265);
  });

  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-85`) — **una moneda que no es el dólar**.
   *
   * Antes la regla sólo sabía convertir `USD` (armaba el mapa `{ USD: … }` con el escalar heredado), así que
   * el mostrador no podía ofrecer ninguna otra moneda. Con el mapa de tasas, sumar un cobro partido en euros
   * es la misma aritmética. Si este caso necesitara un `if EUR`, la arquitectura seguiría mal.
   */
  it("suma un cobro en euros con su propia tasa", () => {
    // 4 × 40 = 160, más 100 en la moneda base.
    const total = paidTotalInBaseCurrency({
      payments: [
        { amount: 4, currency: "EUR" },
        { amount: 100, currency: "NIO" },
      ],
      baseCurrencyCode: "NIO",
      rates: { USD: 36.5, EUR: 40 },
    });

    expect(total).toBe(260);
  });

  it("una fila sin monto válido no rompe la suma", () => {
    const total = paidTotalInBaseCurrency({
      payments: [
        { amount: Number.NaN, currency: "NIO" },
        { amount: 100, currency: "USD" },
      ],
      baseCurrencyCode: "NIO",
      rates: { USD: 36.5 },
    });

    expect(total).toBe(3650);
  });

  it("sin filas el cobrado es cero", () => {
    expect(
      paidTotalInBaseCurrency({ payments: [], baseCurrencyCode: "NIO", rates: { USD: 36.5 } }),
    ).toBe(0);
  });

  it("una moneda base que no es la del dólar funciona igual", () => {
    const total = paidTotalInBaseCurrency({
      payments: [{ amount: 10, currency: "USD" }],
      baseCurrencyCode: "USD",
      rates: { USD: 36.5 },
    });

    // Si la moneda del negocio ES el dólar, la fila en dólares no se convierte: vale lo que dice.
    expect(total).toBe(10);
  });
});
