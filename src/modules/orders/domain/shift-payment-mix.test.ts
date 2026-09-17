import { describe, expect, it } from "vitest";

import type { PaymentRecord } from "@/modules/orders/domain/order.types";

import { summarizeShiftPayments } from "./shift-payment-mix";

/**
 * Tarea 1.2 del roadmap del POS + decisión del owner (2026-09-17) — **el desglose por método de pago del
 * turno**.
 *
 * Hasta acá el cierre solo congelaba el **efectivo** (lo que hay en el cajón). El mensaje de cierre por
 * Telegram necesita además tarjeta, transferencia, total, propinas y cuántos pedidos se cobraron, y esos
 * números salen de los mismos cobros que ya se leen para el arqueo: una sola fuente, para que el mensaje y
 * el cierre no puedan decir cosas distintas.
 *
 * Tres reglas: la **propina entra** en el medio con el que se pagó (es plata que el cliente pagó) y se
 * informa aparte como detalle; el **vuelto solo existe en efectivo** (en tarjeta no hay cambio que dar); y
 * un cobro en dólares se convierte con la tasa cargada —sin tasa, se rechaza en vez de sumar 20 como 20
 * córdobas—.
 */

function payment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "pay_01",
    orderId: "ord_01",
    method: "cash",
    amount: 500,
    currency: null,
    changeAmount: 0,
    tip: 0,
    reference: null,
    createdAt: "2026-09-17T15:00:00.000Z",
    ...overrides,
  };
}

const base = { businessCurrencyCode: "NIO", usdExchangeRate: 36.5 };

describe("summarizeShiftPayments", () => {
  it("separa efectivo, tarjeta y transferencia, y suma el total", () => {
    const mix = summarizeShiftPayments({
      ...base,
      payments: [
        payment({ id: "pay_01", orderId: "ord_01", method: "cash", amount: 500 }),
        payment({ id: "pay_02", orderId: "ord_02", method: "card", amount: 250 }),
        payment({ id: "pay_03", orderId: "ord_03", method: "transfer", amount: 1000 }),
      ],
    });

    expect(mix.cash).toBe(500);
    expect(mix.card).toBe(250);
    expect(mix.transfer).toBe(1000);
    expect(mix.other).toBe(0);
    expect(mix.total).toBe(1750);
    expect(mix.orders).toBe(3);
  });

  it("la propina entra en su medio y se informa aparte", () => {
    const mix = summarizeShiftPayments({
      ...base,
      payments: [
        payment({ id: "pay_01", method: "cash", amount: 500, tip: 50 }),
        payment({ id: "pay_02", method: "card", amount: 250, tip: 25 }),
      ],
    });

    expect(mix.cash).toBe(550);
    expect(mix.card).toBe(275);
    expect(mix.total).toBe(825);
    // La propina es un detalle del total, no una línea que se suma otra vez.
    expect(mix.tips).toBe(75);
  });

  it("el vuelto sale del efectivo: es plata que no quedó en el cajón", () => {
    const mix = summarizeShiftPayments({
      ...base,
      payments: [payment({ method: "cash", amount: 1000, changeAmount: 150 })],
    });

    expect(mix.cash).toBe(850);
    expect(mix.total).toBe(850);
  });

  it("un cobro en dólares se convierte con la tasa cargada", () => {
    const mix = summarizeShiftPayments({
      ...base,
      payments: [payment({ method: "card", amount: 10, currency: "USD" })],
    });

    expect(mix.card).toBe(365);
  });

  it("sin tasa cargada no se inventa el número: se rechaza", () => {
    expect(() =>
      summarizeShiftPayments({
        ...base,
        usdExchangeRate: null,
        payments: [payment({ method: "card", amount: 10, currency: "USD" })],
      }),
    ).toThrow(/tipo de cambio/i);
  });

  it("cuenta pedidos distintos, no cobros: un pago partido es un pedido", () => {
    const mix = summarizeShiftPayments({
      ...base,
      payments: [
        payment({ id: "pay_01", orderId: "ord_01", method: "cash", amount: 30 }),
        payment({ id: "pay_02", orderId: "ord_01", method: "transfer", amount: 50 }),
      ],
    });

    expect(mix.orders).toBe(1);
    expect(mix.total).toBe(80);
  });

  it("mixto y otro van juntos en «otras formas», sin desaparecer del total", () => {
    const mix = summarizeShiftPayments({
      ...base,
      payments: [
        payment({ id: "pay_01", method: "mixed", amount: 100 }),
        payment({ id: "pay_02", method: "other", amount: 50 }),
      ],
    });

    expect(mix.other).toBe(150);
    expect(mix.total).toBe(150);
  });

  it("un turno sin cobros es todo cero, no un error", () => {
    const mix = summarizeShiftPayments({ ...base, payments: [] });

    expect(mix).toMatchObject({ cash: 0, card: 0, transfer: 0, other: 0, total: 0, tips: 0, orders: 0 });
  });
});
