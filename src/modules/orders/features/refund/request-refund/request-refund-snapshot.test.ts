import { describe, expect, it, vi } from "vitest";

import type { MoneyContext } from "@/modules/money/domain/money-context";
import type { PaymentRecord, RefundRecord } from "@/modules/orders/domain/order.types";
import type { CreateRefundInput } from "@/modules/orders/ports/refund-repository";

import { requestRefund, type RefundRequestScope } from "./request-refund";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-82`, `D-020`, `D-024`) — **el snapshot de la
 * devolución**.
 *
 * La migración `20260929120600` agregó `baseCurrencyCode`, `exchangeRate` y `baseAmount` a `Refund` «por
 * simetría con el cobro», y **ninguna devolución productiva las escribió nunca**: `request-refund.ts` las
 * dejaba en `null`. Una columna nueva permanentemente `null` en el camino productivo es lo que el criterio 9
 * de aceptación prohíbe, y el dashboard ya dependía de ese equivalente para restar el neto (`A-74`).
 *
 * Lo que se fija:
 *
 * 1. una devolución **en la moneda del cobro** congela la tasa y el equivalente de **ese** monto;
 * 2. una devolución en la moneda base congela la igualdad (tasa 1);
 * 3. el equivalente sale del **contexto del momento**, no de una tasa escrita en el llamador;
 * 4. sin tasa vigente la devolución **no se pide**: no se puede restar del neto lo que no se puede valuar.
 */
describe("requestRefund · snapshot monetario de la devolución", () => {
  const money: MoneyContext = {
    baseCurrencyCode: "NIO",
    locale: "es-NI",
    rates: { USD: 36.5 },
    knownCurrencyCodes: ["NIO", "USD"],
  };

  function payment(over: Partial<PaymentRecord> = {}): PaymentRecord {
    return {
      id: "pay_01",
      orderId: "ord_01",
      method: "cash",
      amount: 100,
      currency: "USD",
      changeAmount: 0,
      tip: 0,
      reference: null,
      createdAt: "2026-09-14T12:00:00.000Z",
      voidedAt: null,
      voidedByUserId: null,
      voidReason: null,
      baseCurrencyCode: "NIO",
      exchangeRate: 36.5,
      baseAmount: 3650,
      methodKind: "cash",
      ...over,
    } as PaymentRecord;
  }

  function setup(options: { payment?: PaymentRecord; money?: MoneyContext } = {}) {
    const stored = options.payment ?? payment();
    const created: CreateRefundInput[] = [];

    const scope: RefundRequestScope = {
      lockPayment: vi.fn(async () => ({ id: stored.id })),
      findPaymentById: vi.fn(async () => stored),
      listRefundsByPayment: vi.fn(async () => [] as RefundRecord[]),
      findRefundByIdempotencyKey: vi.fn(async () => null),
      createRefund: vi.fn(async (input: CreateRefundInput) => {
        created.push(input);
        return { id: "ref_01", ...input } as unknown as RefundRecord;
      }),
    };

    return {
      created,
      scope,
      dependencies: {
        shiftRepository: { findOpenShiftByLocation: vi.fn(async () => null) },
        runInRefundRequestTransaction: async <T,>(work: (scope: RefundRequestScope) => Promise<T>) =>
          work(scope),
        readMoney: async () => options.money ?? money,
      },
    };
  }

  it("congela la tasa y el equivalente del monto devuelto", async () => {
    const { created, dependencies } = setup();

    await requestRefund(
      {
        paymentId: "pay_01",
        kind: "partial",
        amount: 20,
        reason: "El cliente devolvió un producto",
        requestedByUserId: "usr_manager",
        locationId: "loc_centro",
      },
      dependencies,
    );

    // 20 × 36.5 = 730. El `expected` sale de la regla del negocio, no del helper bajo prueba.
    expect(created[0]).toMatchObject({
      amount: 20,
      currency: "USD",
      baseCurrencyCode: "NIO",
      exchangeRate: 36.5,
      baseAmount: 730,
    });
  });

  it("una devolución en la moneda base congela la igualdad", async () => {
    const { created, dependencies } = setup({ payment: payment({ currency: "NIO", exchangeRate: 1, baseAmount: 100 }) });

    await requestRefund(
      {
        paymentId: "pay_01",
        kind: "partial",
        amount: 20,
        reason: "El cliente devolvió un producto",
        requestedByUserId: "usr_manager",
        locationId: "loc_centro",
      },
      dependencies,
    );

    expect(created[0]).toMatchObject({
      currency: "NIO",
      baseCurrencyCode: "NIO",
      exchangeRate: 1,
      baseAmount: 20,
    });
  });

  it("el equivalente sale del contexto del momento, no de una tasa escrita en el llamador", async () => {
    const { created, dependencies } = setup({ money: { ...money, rates: { USD: 40 } } });

    await requestRefund(
      {
        paymentId: "pay_01",
        kind: "partial",
        amount: 20,
        reason: "El cliente devolvió un producto",
        requestedByUserId: "usr_manager",
        locationId: "loc_centro",
      },
      dependencies,
    );

    // 20 × 40 = 800: la tasa vigente manda, no la del cobro (esa explica el cobro, no la devolución).
    expect(created[0]).toMatchObject({ exchangeRate: 40, baseAmount: 800 });
  });

  it("sin tasa vigente para la moneda del cobro no se pide la devolución", async () => {
    const { created, dependencies } = setup({ money: { ...money, rates: {} } });

    await expect(
      requestRefund(
        {
          paymentId: "pay_01",
          kind: "partial",
          amount: 20,
          reason: "El cliente devolvió un producto",
          requestedByUserId: "usr_manager",
          locationId: "loc_centro",
        },
        dependencies,
      ),
    ).rejects.toThrow(/tasa vigente/i);

    expect(created).toHaveLength(0);
  });
});
