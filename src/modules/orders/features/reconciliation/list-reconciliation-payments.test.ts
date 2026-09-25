import { describe, expect, it, vi } from "vitest";

import type { PaymentRecord } from "@/modules/orders/domain/order.types";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";

import { listReconciliationPayments } from "./list-reconciliation-payments";

/**
 * Tarea 10 del brief (2026-09-17) — **los cobros del día que se concilian** (11.1/11.2).
 *
 * El caso de uso es el que decide qué se exporta: solo tarjeta y transferencia, del local pedido y del día
 * del negocio, del más viejo al más nuevo (el orden en que aparecen en el lote y en el extracto). El
 * resumen sí mira todos los cobros: lo que no es tarjeta ni transferencia se informa aparte en la pantalla.
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
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    ...overrides,
  };
}

function deps(payments: PaymentRecord[]) {
  const listPaymentsInRange = vi.fn(async () => payments);

  return {
    deps: { paymentRepository: { listPaymentsInRange } as unknown as PaymentRepository },
    listPaymentsInRange,
  };
}

const input = {
  locationId: "loc_principal",
  from: "2026-09-17T06:00:00.000Z",
  to: "2026-09-18T05:59:59.999Z",
  baseCurrencyCode: "NIO",
};

describe("listReconciliationPayments", () => {
  it("devuelve solo tarjeta y transferencia, del más viejo al más nuevo", async () => {
    const { deps: dependencies, listPaymentsInRange } = deps([
      payment({ id: "pay_02", method: "transfer", createdAt: "2026-09-17T18:00:00.000Z" }),
      payment({ id: "pay_01", method: "card", createdAt: "2026-09-17T15:00:00.000Z" }),
      payment({ id: "pay_03", method: "cash", createdAt: "2026-09-17T16:00:00.000Z" }),
    ]);

    const result = await listReconciliationPayments(input, dependencies);

    expect(result.data.payments.map((entry) => entry.id)).toEqual(["pay_01", "pay_02"]);
    expect(listPaymentsInRange).toHaveBeenCalledWith("loc_principal", {
      from: input.from,
      to: input.to,
    });
  });

  it("el resumen informa aparte lo que no se concilia", async () => {
    const { deps: dependencies } = deps([
      payment({ id: "pay_01", method: "card", amount: 500 }),
      payment({ id: "pay_02", method: "other", amount: 100 }),
      payment({ id: "pay_03", method: "cash", amount: 9999 }),
    ]);

    const result = await listReconciliationPayments(input, dependencies);

    expect(result.data.summary.methods[0]).toEqual({
      method: "card",
      count: 1,
      byCurrency: { NIO: 500 },
    });
    expect(result.data.summary.others).toEqual({ count: 1, byCurrency: { NIO: 100 } });
  });

  it("un día sin cobros devuelve listas vacías, no un error", async () => {
    const { deps: dependencies } = deps([]);

    const result = await listReconciliationPayments(input, dependencies);

    expect(result.data.payments).toEqual([]);
    expect(result.data.summary.methods.every((method) => method.count === 0)).toBe(true);
  });
});
