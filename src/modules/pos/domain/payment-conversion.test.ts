import { describe, expect, it } from "vitest";

import type { MoneyContext } from "@/modules/money/domain/money-context";

import { PosError } from "./pos-errors";
import {
  convertPaymentToBusinessCurrency,
  recordedPaymentsBaseTotal,
} from "./payment-conversion";

/**
 * TASK-303a/305 + `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — cuánto vale un cobro en la
 * **moneda base vigente**.
 *
 * El mostrador cobra en la moneda del negocio, pero el cliente puede pagar en otra. La conversión usa la
 * tasa **vigente por moneda** que resuelve `money` (`contexto monetario`), no el escalar del dólar de
 * `BusinessSettings`: con el escalar, una moneda que el negocio hubiera aceptado en Finanzas no se podía
 * cobrar, y la base se leía de la configuración vieja.
 *
 * Las tres salidas se distinguen a propósito, porque cada una se arregla en un lugar distinto: convierte ·
 * la moneda no está en el catálogo (se arregla en Finanzas agregándola) · la moneda está pero no tiene tasa
 * vigente (se arregla registrándola). Antes las dos últimas decían «cargá el tipo de cambio del dólar», que
 * era una instrucción imposible de cumplir para cualquier moneda que no fuera el dólar.
 */

const money: MoneyContext = {
  baseCurrencyCode: "NIO",
  locale: "es-NI",
  rates: { USD: 36.5, EUR: 40 },
  knownCurrencyCodes: ["NIO", "USD", "EUR"],
};

describe("conversión de un cobro a la moneda base vigente", () => {
  it("un cobro en la moneda base queda igual, redondeado a dos decimales", () => {
    expect(convertPaymentToBusinessCurrency({ amount: 130, currency: "NIO", money })).toBe(130);

    // 130.005 se redondea al centavo: la aritmética la hace `money`, no este módulo.
    expect(convertPaymentToBusinessCurrency({ amount: 130.005, currency: "NIO", money })).toBe(130.01);
  });

  it("un cobro en otra moneda se convierte con su tasa vigente", () => {
    // 10 × 36.5 y 10 × 36.579. El `expected` sale de la regla, no del helper.
    expect(convertPaymentToBusinessCurrency({ amount: 10, currency: "USD", money })).toBe(365);
    expect(
      convertPaymentToBusinessCurrency({
        amount: 10,
        currency: "USD",
        money: { ...money, rates: { USD: 36.579 } },
      }),
    ).toBe(365.79);
  });

  it("funciona con una moneda que no es el dólar y no tiene código especial", () => {
    // 2 × 40 = 80. Si esto necesitara un `if EUR`, la arquitectura seguiría mal.
    expect(convertPaymentToBusinessCurrency({ amount: 2, currency: "EUR", money })).toBe(80);
  });

  it("no le importan mayúsculas ni espacios en la moneda", () => {
    expect(
      convertPaymentToBusinessCurrency({
        amount: 5,
        currency: " usd ",
        money: { ...money, rates: { USD: 36 } },
      }),
    ).toBe(180);
  });

  it("sin tasa vigente rechaza el cobro mandando a registrar la tasa", () => {
    for (const rate of [null, 0, -3]) {
      try {
        convertPaymentToBusinessCurrency({
          amount: 10,
          currency: "USD",
          money: { ...money, rates: { USD: rate } },
        });
        throw new Error("tendría que haber lanzado");
      } catch (error) {
        expect(error).toBeInstanceOf(PosError);
        const fields = (error as PosError).fields ?? {};
        expect(String(fields.currency ?? "")).toContain("USD");
        expect(String((error as PosError).message)).toContain("tasa vigente");
      }
    }
  });

  it("una moneda que el catálogo no conoce se rechaza nombrando la moneda", () => {
    try {
      convertPaymentToBusinessCurrency({ amount: 10, currency: "JPY", money });
      throw new Error("tendría que haber lanzado");
    } catch (error) {
      expect((error as PosError).fields?.currency).toContain("JPY");
      expect(String((error as PosError).message)).toContain("Todavía no se cobra");
    }
  });

  it("rechaza un monto negativo", () => {
    expect(() => convertPaymentToBusinessCurrency({ amount: -1, currency: "NIO", money })).toThrow(
      PosError,
    );
  });
});

/**
 * `A-81`/`D-020` — la suma de un **reintento** sale del equivalente que cada cobro congeló.
 *
 * Es la regla que impide reconstruir el pasado: si el reintento volviera a convertir con la tasa de hoy, el
 * número que el cajero ya vio cambiaría solo porque alguien tocó Finanzas.
 */
describe("suma de los cobros ya congelados", () => {
  it("suma los equivalentes persistidos y redondea al centavo", () => {
    expect(
      recordedPaymentsBaseTotal([{ baseAmount: 80 }, { baseAmount: 365.004 }]),
    ).toBe(445);
  });

  it("un cobro legacy sin snapshot no se reinterpreta: vale 0", () => {
    expect(recordedPaymentsBaseTotal([{ baseAmount: null }, { baseAmount: 365 }])).toBe(365);
  });
});
