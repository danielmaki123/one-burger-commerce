import { describe, expect, it } from "vitest";

import {
  assertIdempotencyKey,
  buildPaymentSnapshot,
  PAYMENT_METHOD_KINDS,
  PAYMENT_SNAPSHOT_FIELDS,
} from "@/modules/payments/domain/payment-snapshot";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-017`, `D-020`) — **un cobro nuevo no se firma sin su snapshot**.
 *
 * El hecho histórico tiene que poder explicarse **para siempre** sin consultar la configuración de hoy (ley
 * 7). Los cinco primeros campos —monto original, moneda, moneda base, tasa aplicada y equivalente en
 * moneda base— son **obligatorios**: sin ellos el cobro no se firma. Esa obligatoriedad es una regla de
 * **dominio y de transacción**, no un `NOT NULL` de la columna: los cobros legacy tienen que poder seguir
 * leyéndose.
 *
 * El medio comercial se configura y puede cambiar de nombre, de monedas o de tipo; el hecho congela
 * `paymentMethodId` **y** `methodKind` para que siga explicando con qué semántica contable entró esa plata.
 */
describe("PAYMENT_SNAPSHOT_FIELDS", () => {
  it("son los cinco de D-020, ni uno menos", () => {
    expect([...PAYMENT_SNAPSHOT_FIELDS]).toEqual([
      "amount",
      "currency",
      "baseCurrencyCode",
      "exchangeRate",
      "baseAmount",
    ]);
  });
});

describe("PAYMENT_METHOD_KINDS", () => {
  it("el tipo canónico no incluye `mixed`: se deriva de más de un cobro (D-017)", () => {
    expect([...PAYMENT_METHOD_KINDS]).toEqual(["cash", "card", "bank_transfer", "wallet", "other"]);
    expect((PAYMENT_METHOD_KINDS as readonly string[]).includes("mixed")).toBe(false);
  });
});

describe("buildPaymentSnapshot", () => {
  const base = {
    amount: 10,
    currency: "usd",
    baseCurrencyCode: " nio ",
    exchangeRate: 36.5,
    methodKind: "cash" as const,
  };

  it("normaliza la moneda, la moneda base y calcula el equivalente base", () => {
    const snapshot = buildPaymentSnapshot(base);

    expect(snapshot.currency).toBe("USD");
    expect(snapshot.baseCurrencyCode).toBe("NIO");
    expect(snapshot.exchangeRate).toBe(36.5);
    // 10 × 36.5 = 365 — el equivalente que el saldo del pedido va a sumar.
    expect(snapshot.baseAmount).toBe(365);
  });

  it("acepta un monto en la moneda base con tasa 1", () => {
    const snapshot = buildPaymentSnapshot({ ...base, amount: 365, currency: "NIO", exchangeRate: 1 });

    expect(snapshot.baseAmount).toBe(365);
  });

  it("redondea el equivalente al centavo con el redondeo único de `money`", () => {
    const snapshot = buildPaymentSnapshot({ ...base, amount: 3, exchangeRate: 36.355 });

    expect(snapshot.baseAmount).toBe(109.07);
  });

  it("rechaza un monto que no es un número positivo", () => {
    for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => buildPaymentSnapshot({ ...base, amount })).toThrowError(/monto/i);
    }
  });

  it("rechaza un cobro sin moneda: `null` ya no se acepta en un cobro NUEVO (D-020)", () => {
    expect(() => buildPaymentSnapshot({ ...base, currency: "   " })).toThrowError(/moneda/i);
  });

  it("rechaza un cobro sin moneda base", () => {
    expect(() => buildPaymentSnapshot({ ...base, baseCurrencyCode: "" })).toThrowError(/moneda base/i);
  });

  it("rechaza un cobro sin tasa aplicada: sin tasa el equivalente no se explica", () => {
    for (const exchangeRate of [null, undefined, 0, -1, Number.NaN]) {
      expect(() =>
        buildPaymentSnapshot({ ...base, exchangeRate: exchangeRate as number }),
      ).toThrowError(/tasa/i);
    }
  });

  it("rechaza un tipo de medio que no es canónico (`mixed` incluido)", () => {
    expect(() =>
      buildPaymentSnapshot({ ...base, methodKind: "mixed" as never }),
    ).toThrowError(/medio/i);
  });

  it("un cobro en moneda distinta a la base con tasa 1 es válido: la tasa es un dato, no una inferencia", () => {
    // El dominio no adivina la tasa que «debería» ser: valida que exista y que sea positiva. Que 1 sea la
    // tasa correcta para un par distinto lo decide la configuración, no esta función.
    const snapshot = buildPaymentSnapshot({ ...base, amount: 20, exchangeRate: 1 });

    expect(snapshot.baseAmount).toBe(20);
  });
});

describe("assertIdempotencyKey", () => {
  it("normaliza la clave que manda el cliente", () => {
    expect(assertIdempotencyKey("  sale_abc-123  ")).toBe("sale_abc-123");
  });

  it("exige una clave: la idempotencia la garantiza la base, pero la clave la manda el cliente (A-71)", () => {
    for (const key of ["", "   ", null, undefined]) {
      expect(() => assertIdempotencyKey(key as string)).toThrowError(/clave/i);
    }
  });

  it("rechaza una clave absurdamente larga", () => {
    expect(() => assertIdempotencyKey("x".repeat(200))).toThrowError(/clave/i);
  });

  it("acepta un límite razonable de 80 caracteres", () => {
    expect(assertIdempotencyKey("x".repeat(80))).toHaveLength(80);
  });
});
