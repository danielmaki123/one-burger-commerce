import { describe, expect, it, vi } from "vitest";

import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";
import type { MoneyContext } from "@/modules/money/domain/money-context";

import { addPosLine, createPosDraft } from "../../domain/pos-draft";
import { commitSale } from "./commit-sale";
import type { PosSaleTransactionScope, RegisterPosSaleInput } from "./register-pos-sale";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`, `D-020`, `D-024`) — **el snapshot del cobro del
 * POS**.
 *
 * El camino productivo del mostrador era el **único** que creaba `Payment` sin pasar por la construcción
 * canónica: el cobro quedaba con `baseCurrencyCode`, `exchangeRate`, `baseAmount`, `methodKind`,
 * `paymentMethodId` y `entityId` en `null` (`A-81`). Sin esos campos el hecho no se puede explicar después
 * sin volver a la configuración de hoy (ley 7), y el saldo del pedido queda medido contra una suma cruda.
 *
 * Lo que se fija acá:
 *
 * 1. **Cada** cobro de la venta —el simple y cada parte del mixto— se firma con su snapshot completo;
 * 2. un cobro en la moneda base congela la igualdad (tasa `1`, equivalente igual al monto), no un `null`;
 * 3. un cobro partido entre dos monedas congela **dos** tasas distintas en la misma venta;
 * 4. una moneda sin tasa vigente **rechaza la venta antes de escribir nada**: no se crea el pedido ni el
 *    primer cobro.
 */
describe("commitSale · snapshot monetario del cobro", () => {
  const money: MoneyContext = {
    baseCurrencyCode: "NIO",
    locale: "es-NI",
    rates: { USD: 36.5, EUR: 40 },
    knownCurrencyCodes: ["NIO", "USD", "EUR"],
  };

  function order(over: Partial<OrderRecord> = {}): OrderRecord {
    return {
      id: "ord_01",
      orderNumber: "P-ABC123",
      type: "pickup",
      status: "new",
      locationId: "loc_centro",
      customerName: "Cliente Mostrador",
      customerWhatsapp: "+50588887777",
      customerEmail: null,
      items: [],
      subtotal: 70,
      discount: 0,
      packagingAmount: 10,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      total: 80,
      createdAt: "2026-09-14T12:00:00.000Z",
      updatedAt: "2026-09-14T12:00:00.000Z",
      ...over,
    } as OrderRecord;
  }

  function saleInput(payments: RegisterPosSaleInput["payments"]): RegisterPosSaleInput {
    return {
      draft: addPosLine(createPosDraft("loc_centro"), {
        productId: "prod_taco",
        name: "Taco de birria",
        unitPrice: 35,
        packagingUnitAmount: 5,
        quantity: 2,
      }),
      customer: { name: "Cliente Mostrador", whatsapp: "88887777" },
      payments,
    };
  }

  function setup(reusedOrder: OrderRecord = order(), reused = false) {
    const paymentRepository = new InMemoryPaymentRepository();
    const createPosOrder = vi.fn(async () => ({ order: reusedOrder, reused }));
    const scope: PosSaleTransactionScope = {
      createPosOrder,
      paymentRepository,
      lockShift: vi.fn(async (shiftId: string) => ({ id: shiftId, status: "open" })),
    };

    return { scope, createPosOrder };
  }

  it("en un cobro en la moneda base congela la igualdad, no un null", async () => {
    const { scope } = setup();

    const result = await commitSale({
      input: saleInput([{ method: "cash", amount: 80, currency: "NIO" }]),
      couponCode: null,
      paidInBusinessCurrency: 80,
      openShift: { id: "shift_01" },
      scope,
      money,
    });

    expect(result.payments[0]).toMatchObject({
      amount: 80,
      currency: "NIO",
      baseCurrencyCode: "NIO",
      exchangeRate: 1,
      baseAmount: 80,
      methodKind: "cash",
    });
  });

  it("en un cobro partido congela la tasa de cada moneda en la misma venta", async () => {
    const { scope } = setup(order({ total: 445 }));

    const result = await commitSale({
      input: saleInput([
        { method: "cash", amount: 80, currency: "NIO" },
        { method: "card", amount: 10, currency: "USD" },
      ]),
      couponCode: null,
      paidInBusinessCurrency: 445,
      openShift: { id: "shift_01" },
      scope,
      money,
    });

    // 80 NIO (tasa 1) y US$10 × 36.5 = C$365. El `expected` sale de la regla del negocio, no del helper.
    expect(result.payments.map((payment) => payment.baseAmount)).toEqual([80, 365]);
    expect(result.payments.map((payment) => payment.exchangeRate)).toEqual([1, 36.5]);
    expect(result.payments.map((payment) => payment.baseCurrencyCode)).toEqual(["NIO", "NIO"]);
    expect(result.payments.map((payment) => payment.methodKind)).toEqual(["cash", "card"]);
  });

  it("rechaza la venta en una moneda sin tasa vigente sin escribir el pedido ni el primer cobro", async () => {
    const { scope, createPosOrder } = setup(order({ total: 445 }));
    const withoutUsd: MoneyContext = {
      baseCurrencyCode: "NIO",
      locale: "es-NI",
      rates: { EUR: 40 },
      knownCurrencyCodes: ["NIO", "USD", "EUR"],
    };

    await expect(
      commitSale({
        input: saleInput([{ method: "cash", amount: 10, currency: "USD" }]),
        couponCode: null,
        paidInBusinessCurrency: 365,
        openShift: { id: "shift_01" },
        scope,
        money: withoutUsd,
      }),
    ).rejects.toThrow(/tasa/i);

    // Sin equivalente no hay cobro firmable: la falla tiene que ser **antes** de tocar la base.
    expect(createPosOrder).not.toHaveBeenCalled();
  });

  it("el reintento no vuelve a cobrar y suma el equivalente **persistido**, no la tasa de hoy", async () => {
    const { scope } = setup(order({ total: 300 }), true);
    const repository = scope.paymentRepository as InMemoryPaymentRepository;
    // El cobro del primer intento, con la tasa que regía entonces (30, no la de hoy).
    repository.payments.push({
      id: "pay_previo",
      orderId: "ord_01",
      method: "card",
      amount: 10,
      currency: "USD",
      changeAmount: 0,
      tip: 0,
      reference: null,
      createdAt: "2026-09-14T12:00:00.000Z",
      voidedAt: null,
      voidedByUserId: null,
      voidReason: null,
      baseCurrencyCode: "NIO",
      exchangeRate: 30,
      baseAmount: 300,
      methodKind: "card",
    } as never);

    const result = await commitSale({
      input: saleInput([{ method: "card", amount: 10, currency: "USD" }]),
      couponCode: null,
      paidInBusinessCurrency: 365,
      openShift: { id: "shift_01" },
      scope,
      money,
    });

    expect(result.reused).toBe(true);
    // 10 × 30 = 300. Con la tasa vigente (36.5) daría 365: reconstruir el pasado es el bug.
    expect(result.paidInBusinessCurrency).toBe(300);
  });
});
