import { describe, expect, it } from "vitest";

import {
  OUTSTANDING_UNRESOLVED,
  projectOrderPaymentStatus,
  type OrderFinancialInput,
  type OrderPaymentStatus,
  type PaymentForFinancials,
} from "@/modules/payments/domain/order-financial-status";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — **el estado financiero canónico del pedido** (`D-016`, `D-020`,
 * `D-021`).
 *
 * Hoy no existe en ninguna capa: la factura decide «pagado» con `payments.length > 0`, el POS suma montos
 * **crudos** de monedas distintas y el cobro de un pedido existente compara la suma cruda contra el total
 * (`A-68`: un pedido de C$365 acepta US$10 como «10 pagados» y deja cobrar otros C$355).
 *
 * Las tres reglas que estos tests fijan, y que son la regla del negocio (no de la implementación):
 *
 * 1. `paidAmount` suma **sólo lo demostrable**, en moneda base, usando el snapshot de cada cobro.
 * 2. `paid` ⇔ `outstandingAmount == 0` **y** `unresolvedAmount == 0`. Nunca se deriva del conteo.
 * 3. Lo que no se puede demostrar **no se convierte con la tasa vigente**: se declara (`D-020`).
 *
 * `resolvedBaseAmount` es el equivalente que un **dato persistido** demuestra (el esperado de un `Shift`
 * cerrado que ya congeló las dos monedas, un cobro hermano del mismo hecho). Se resuelve explícito y por
 * caso, nunca por una regla general de conversión hacia atrás.
 */

const T = "2026-09-29T15:00:00.000Z";

/** Un cobro **nuevo**: congeló su snapshot (monto, moneda, moneda base, tasa y equivalente). */
function modern(over: Partial<PaymentForFinancials> = {}): PaymentForFinancials {
  return {
    id: "pay_modern",
    amount: 365,
    currency: "NIO",
    baseCurrencyCode: "NIO",
    exchangeRate: 1,
    baseAmount: 365,
    method: "cash",
    createdAt: T,
    voidedAt: null,
    ...over,
  };
}

/** Un cobro **legacy**: existe desde antes del snapshot. No tiene tasa ni equivalente. */
function legacy(over: Partial<PaymentForFinancials> = {}): PaymentForFinancials {
  return {
    id: "pay_legacy",
    amount: 365,
    currency: "NIO",
    baseCurrencyCode: null,
    exchangeRate: null,
    baseAmount: null,
    method: "cash",
    createdAt: "2026-09-01T15:00:00.000Z",
    voidedAt: null,
    ...over,
  };
}

function order(over: Partial<OrderFinancialInput> = {}): OrderFinancialInput {
  return { orderId: "ord_1", total: 365, baseCurrencyCode: "NIO", payments: [], ...over };
}

/**
 * El resolutor de equivalencia legacy que el caso de uso inyecta. `null` por defecto: en estos tests ningún
 * cobro legacy tiene un dato persistido que demuestre su equivalente, salvo el que lo declara explícito.
 */
async function financials(
  input: Partial<OrderFinancialInput> = {},
  resolveLegacyBaseAmount: (payment: PaymentForFinancials) => number | null = () => null,
): Promise<OrderPaymentStatus> {
  return Promise.resolve(projectOrderPaymentStatus(order(input), { resolveLegacyBaseAmount }));
}

describe("projectOrderPaymentStatus — el saldo", () => {
  it("un pedido sin cobros está `pending` con el total pendiente", async () => {
    const status = await financials();

    expect(status.status).toBe("pending");
    expect(status.paidAmount).toBe(0);
    expect(status.outstandingAmount).toBe(365);
    expect(status.unresolvedAmount).toBe(0);
    expect(status.paymentCount).toBe(0);
    expect(status.hasMixedMethods).toBe(false);
    expect(status.baseCurrencyCode).toBe("NIO");
  });

  it("un cobro parcial en moneda base queda `partial`", async () => {
    const status = await financials({ payments: [modern({ amount: 100, baseAmount: 100 })] });

    expect(status.status).toBe("partial");
    expect(status.paidAmount).toBe(100);
    expect(status.outstandingAmount).toBe(265);
    expect(status.paymentCount).toBe(1);
  });

  it("un cobro en moneda extranjera cubre el total con su equivalente, no con su monto crudo (A-68)", async () => {
    // El caso textual del hallazgo: US$10 a tasa 36.5 sobre un pedido de C$365. Antes, el cobro veía
    // «10 pagados» y dejaba cargar C$355 más.
    const status = await financials({
      payments: [
        modern({ id: "pay_usd", amount: 10, currency: "USD", exchangeRate: 36.5, baseAmount: 365 }),
      ],
    });

    expect(status.status).toBe("paid");
    expect(status.paidAmount).toBe(365);
    expect(status.outstandingAmount).toBe(0);
    expect(status.unresolvedAmount).toBe(0);
  });

  it("`paidAmount` sale en UNA sola moneda aunque haya varias en los cobros", async () => {
    const status = await financials({
      total: 730,
      payments: [
        modern({ id: "p1", amount: 10, currency: "USD", exchangeRate: 36.5, baseAmount: 365 }),
        modern({ id: "p2", amount: 365, currency: "NIO", exchangeRate: 1, baseAmount: 365 }),
      ],
    });

    // 365 + 365 = 730 en moneda base. La suma cruda habría dado 375.
    expect(status.paidAmount).toBe(730);
    expect(status.outstandingAmount).toBe(0);
    expect(status.status).toBe("paid");
  });

  it("`hasMixedMethods` se DERIVA de más de un medio distinto (`mixed` no es un medio, D-017)", async () => {
    const status = await financials({
      total: 500,
      payments: [
        modern({ id: "p1", amount: 300, baseAmount: 300, method: "cash" }),
        modern({ id: "p2", amount: 200, baseAmount: 200, method: "card" }),
      ],
    });

    expect(status.hasMixedMethods).toBe(true);
    expect(status.status).toBe("paid");
  });

  it("dos cobros del MISMO medio no son mixto", async () => {
    const status = await financials({
      total: 500,
      payments: [
        modern({ id: "p1", amount: 300, baseAmount: 300, method: "cash" }),
        modern({ id: "p2", amount: 200, baseAmount: 200, method: "cash" }),
      ],
    });

    expect(status.hasMixedMethods).toBe(false);
  });

  it("el valor histórico `mixed` no cuenta como medio para la bandera derivada", async () => {
    const status = await financials({
      total: 500,
      payments: [
        modern({ id: "p1", amount: 100, baseAmount: 100, method: "mixed" }),
        modern({ id: "p2", amount: 400, baseAmount: 400, method: "mixed" }),
      ],
    });

    // `mixed` puede existir en la base y se muestra tal cual era, pero no es un medio: dos filas `mixed`
    // describen un solo medio derivado, no dos.
    expect(status.hasMixedMethods).toBe(false);
  });

  it("un cobro ANULADO no cuenta (`A-59`, invariante que se conserva)", async () => {
    const status = await financials({
      total: 500,
      payments: [
        modern({ id: "p1", amount: 500, baseAmount: 500, voidedAt: "2026-09-29T16:00:00.000Z" }),
      ],
    });

    expect(status.status).toBe("pending");
    expect(status.paidAmount).toBe(0);
    expect(status.outstandingAmount).toBe(500);
    expect(status.paymentCount).toBe(0);
  });

  it("nunca deja `outstandingAmount` negativo: cobrar de más es un error, no un crédito", async () => {
    const status = await financials({
      total: 100,
      payments: [modern({ amount: 150, baseAmount: 150 })],
    });

    expect(status.outstandingAmount).toBe(0);
    expect(status.paidAmount).toBe(150);
  });
});

describe("projectOrderPaymentStatus — el legacy no demostrable (D-020)", () => {
  it("un cobro legacy sin snapshot NO se convierte con la tasa vigente: queda `unresolved`", async () => {
    // El pedido nominalmente está cubierto (C$365 sobre C$365), pero **no se puede demostrar** a qué
    // equivalía ese cobro. Afirmar `paid` acá es inventar el hecho que la ley 7 prohíbe inventar.
    const status = await financials({ payments: [legacy({ currency: "USD" })] });

    expect(status.status).toBe("partial");
    expect(status.paidAmount).toBe(0);
    expect(status.unresolvedAmount).toBe(365);
    expect(status.outstandingAmount).toBe(365);
    expect(status.status).not.toBe("paid");
  });

  it("un pedido con `unresolvedAmount > 0` NUNCA está `paid`, aunque el monto nominal cubra el total", async () => {
    const status = await financials({
      total: 465,
      payments: [legacy({ amount: 365, currency: "USD" }), modern({ id: "p2", amount: 100, baseAmount: 100 })],
    });

    expect(status.paidAmount).toBe(100);
    expect(status.unresolvedAmount).toBe(365);
    expect(status.outstandingAmount).toBe(365);
    expect(status.status).toBe("partial");
  });

  it("un legacy SIN moneda se resuelve como la moneda del negocio, y ahí su equivalente es una identidad", async () => {
    // `Payment.currency` nulo significa «la moneda del negocio» (`money` resuelve ese `null`, nadie más).
    // Lo que un cobro legacy **no** tiene es la **tasa**; y una tasa no hace falta cuando el cobro entró en
    // la moneda base: `365 NIO` vale `365 NIO`. Distinto es un legacy en moneda **extranjera**, que sí
    // queda `unresolved` (el caso de arriba).
    const status = await financials({ payments: [legacy({ currency: null })] });

    expect(status.paidAmount).toBe(365);
    expect(status.unresolvedAmount).toBe(0);
    expect(status.status).toBe("paid");
  });

  it("un cobro con snapshot de OTRA moneda base queda `unresolved` (no se re-convierte)", async () => {
    // La moneda base se puede cambiar (`D-018`) y eso **no** recalcula nada: un cobro convertido contra
    // otra base conserva su equivalente y no se traduce a la base de hoy.
    const status = await financials({
      payments: [
        modern({ amount: 10, currency: "USD", baseCurrencyCode: "USD", exchangeRate: 1, baseAmount: 10 }),
      ],
    });

    expect(status.unresolvedAmount).toBe(10);
    expect(status.paidAmount).toBe(0);
    expect(status.status).toBe("partial");
  });

  it("un efectivo legacy en la moneda base SÍ es demostrable: no hace falta tasa para una identidad", async () => {
    // El único caso donde el equivalente no necesita una tasa es cuando la moneda del cobro **es** la
    // moneda base: `1 NIO` vale `1 NIO`. No es una conversión hacia atrás, es una identidad.
    const status = await financials({ payments: [legacy({ amount: 365, currency: "NIO" })] });

    expect(status.paidAmount).toBe(365);
    expect(status.unresolvedAmount).toBe(0);
    expect(status.status).toBe("paid");
  });

  it("un legacy en la moneda base con monto chico es `partial` con saldo", async () => {
    const status = await financials({ payments: [legacy({ amount: 100, currency: "NIO" })] });

    expect(status.paidAmount).toBe(100);
    expect(status.outstandingAmount).toBe(265);
    expect(status.status).toBe("partial");
  });
});

describe("projectOrderPaymentStatus — equivalencia demostrada por un dato persistido (D-020)", () => {
  it("un cobro legacy cuyo cierre ya congeló el esperado en ambas monedas se resuelve con ESE dato", async () => {
    const status = await financials({ payments: [legacy({ amount: 10, currency: "USD" })] }, () => 365);

    expect(status.paidAmount).toBe(365);
    expect(status.unresolvedAmount).toBe(0);
    expect(status.status).toBe("paid");
  });

  it("el equivalente demostrado manda sobre cualquier tasa vigente: el saldo sale del dato, no de hoy", async () => {
    const status = await financials(
      { total: 400, payments: [legacy({ amount: 10, currency: "USD" })] },
      () => 365,
    );

    expect(status.paidAmount).toBe(365);
    expect(status.outstandingAmount).toBe(35);
    expect(status.status).toBe("partial");
  });

  it("un cobro con snapshot NO consulta al resolutor de legacy", async () => {
    let consulted = 0;
    const status = await financials({ payments: [modern()] }, () => {
      consulted += 1;
      return 999;
    });

    expect(consulted).toBe(0);
    expect(status.paidAmount).toBe(365);
  });
});

describe("projectOrderPaymentStatus — la precedencia exacta de `status`", () => {
  it("sin plata demostrable ni no demostrable es `pending`, aunque haya filas", async () => {
    const status = await financials({ payments: [modern({ amount: 0, baseAmount: 0 })] });

    expect(status.status).toBe("pending");
  });

  it("`unresolvedAmount` solo ya alcanza para `partial`", async () => {
    const status = await financials({ total: 0, payments: [legacy({ amount: 50, currency: "USD" })] });

    expect(status.status).toBe("partial");
  });

  it("el total cubierto sin nada pendiente y sin nada sin demostrar es `paid`", async () => {
    const status = await financials({ total: 0, payments: [modern({ amount: 0, baseAmount: 0 })] });

    expect(status.status).toBe("paid");
  });
});

describe("OUTSTANDING_UNRESOLVED", () => {
  it("existe un centinela explícito para el alcance que no se puede liquidar", () => {
    // Lo usa el consumidor que necesita decir «esto no se puede cerrar hasta que alguien decida», en vez
    // de tratar el pedido como si estuviera cobrado.
    expect(OUTSTANDING_UNRESOLVED).toBe("unresolved");
  });
});
