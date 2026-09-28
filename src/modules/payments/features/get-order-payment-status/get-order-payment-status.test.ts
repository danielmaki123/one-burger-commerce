import { describe, expect, it } from "vitest";

import { getOrderPaymentStatus } from "./get-order-payment-status";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el **borde** del estado financiero.
 *
 * La regla se prueba en el dominio (`domain/order-financial-status.test.ts`), con los tres casos del brief:
 * el cobro en otra moneda que cubre su equivalente (`A-68`), el cobro legacy que **no** se convierte con la
 * tasa de hoy (`D-020`) y la precedencia exacta de `pending`/`partial`/`paid`. Lo que este test fija es el
 * contrato del caso de uso: **sin** el resolutor de legacy el sistema es más estricto (declara
 * `unresolvedAmount`), nunca más permisivo — que es la dirección en la que un error de dinero no se comete.
 */
describe("getOrderPaymentStatus", () => {
  const payment = {
    id: "pay_legacy",
    amount: 365,
    currency: "USD",
    baseCurrencyCode: null,
    exchangeRate: null,
    baseAmount: null,
    method: "cash",
    createdAt: "2026-09-01T15:00:00.000Z",
    voidedAt: null,
  };

  const order = {
    orderId: "ord_1",
    total: 365,
    baseCurrencyCode: "NIO",
    payments: [payment],
  };

  it("sin resolutor de legacy, un cobro sin snapshot queda `unresolved` y el pedido no está `paid`", async () => {
    const status = await getOrderPaymentStatus(order);

    expect(status.status).toBe("partial");
    expect(status.paidAmount).toBe(0);
    expect(status.unresolvedAmount).toBe(365);
    expect(status.outstandingAmount).toBe(365);
  });

  it("con la equivalencia demostrada por un dato persistido, el mismo cobro sí explica su saldo", async () => {
    const status = await getOrderPaymentStatus(order, {
      resolveLegacyBaseAmount: () => 365,
    });

    expect(status.status).toBe("paid");
    expect(status.paidAmount).toBe(365);
    expect(status.unresolvedAmount).toBe(0);
  });

  it("un pedido sin cobros no necesita ninguna dependencia para responder `pending`", async () => {
    const status = await getOrderPaymentStatus({
      orderId: "ord_2",
      total: 100,
      baseCurrencyCode: "NIO",
      payments: [],
    });

    expect(status.status).toBe("pending");
    expect(status.outstandingAmount).toBe(100);
  });
});
