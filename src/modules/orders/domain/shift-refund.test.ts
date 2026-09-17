import { describe, expect, it } from "vitest";

import {
  refundsTotalByCurrency,
  refundsTotalInBusinessCurrency,
  type RefundRecord,
} from "./shift-refund";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — las devoluciones y el arqueo.
 *
 * Una devolución en **efectivo** saca plata del cajón: si no entra al esperado, el cierre marca
 * faltante y el cajero queda como responsable de plata que devolvió con motivo. Una devolución
 * **rechazada** no movió nada y no puede restar; una **pendiente** tampoco, porque todavía no salió.
 *
 * El monto va positivo (el signo lo pone el acá) y cada devolución se resta en **su** moneda.
 */
function refund(over: Partial<RefundRecord> & { id: string }): RefundRecord {
  return {
    paymentId: "pay_01",
    orderId: "ord_01",
    shiftId: "shift_01",
    kind: "partial",
    method: "cash",
    amount: 200,
    currency: "NIO",
    reason: "Faltaba una bebida",
    status: "approved",
    requestedByUserId: "user_cashier",
    approvedByUserId: "user_manager",
    approvedAt: "2026-09-17T19:00:00.000Z",
    createdAt: "2026-09-17T18:55:00.000Z",
    ...over,
  };
}

describe("devoluciones del turno", () => {
  it("resta las devoluciones en efectivo aprobadas, por moneda", () => {
    const totals = refundsTotalByCurrency([
      refund({ id: "r1", amount: 200, currency: "NIO" }),
      refund({ id: "r2", amount: 20, currency: "USD" }),
      refund({ id: "r3", amount: 150, currency: "NIO" }),
    ]);

    expect(totals).toEqual({ NIO: -350, USD: -20 });
  });

  it("no resta lo que no salió del cajón: pendientes, rechazadas y tarjeta", () => {
    const totals = refundsTotalByCurrency([
      refund({ id: "r1", amount: 100, currency: "NIO" }),
      refund({ id: "r2", status: "pending", amount: 500, currency: "NIO" }),
      refund({ id: "r3", status: "rejected", amount: 500, currency: "NIO" }),
      refund({ id: "r4", method: "card", amount: 500, currency: "NIO" }),
    ]);

    expect(totals).toEqual({ NIO: -100 });
  });

  it("sin devoluciones devuelve un objeto vacío, no ceros", () => {
    expect(refundsTotalByCurrency([])).toEqual({});
  });

  it("convierte el neto a la moneda del negocio con la tasa", () => {
    const total = refundsTotalInBusinessCurrency({
      refunds: [
        refund({ id: "r1", amount: 200, currency: "NIO" }),
        refund({ id: "r2", amount: 10, currency: "USD" }),
      ],
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    // 200 + 10 × 36.5 = 565, en negativo (sale del cajón).
    expect(total).toBe(-565);
  });
});
