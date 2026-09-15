import { describe, expect, it } from "vitest";

import { InMemoryPaymentRepository } from "./in-memory-payment-repository";

/**
 * TASK-103 — comportamiento del puerto de cobros.
 *
 * El adaptador de Prisma se prueba contra estos mismos casos con su cliente mockeado, así que las
 * dos implementaciones no pueden divergir en las reglas: guardar el monto con dos decimales, sumar
 * propina aparte, dejar `reference` vacía cuando no viene, y ordenar por fecha de cobro.
 */
describe("InMemoryPaymentRepository", () => {
  it("guarda un cobro con sus datos y lo devuelve", async () => {
    const repository = new InMemoryPaymentRepository();

    const payment = await repository.createPayment({
      orderId: "ord_01",
      method: "cash",
      amount: 150.5,
      tip: 15.05,
      reference: "voucher-77",
    });

    expect(payment.orderId).toBe("ord_01");
    expect(payment.method).toBe("cash");
    expect(payment.amount).toBe(150.5);
    expect(payment.tip).toBe(15.05);
    expect(payment.reference).toBe("voucher-77");
    expect(payment.id).toBeTruthy();
    expect(payment.createdAt).toBeTruthy();
  });

  it("sin propina la propina queda en 0 y sin referencia queda null", async () => {
    const repository = new InMemoryPaymentRepository();

    const payment = await repository.createPayment({
      orderId: "ord_01",
      method: "card",
      amount: 100,
    });

    expect(payment.tip).toBe(0);
    expect(payment.reference).toBeNull();
  });

  it("un pago mixto son varias filas del mismo pedido", async () => {
    const repository = new InMemoryPaymentRepository();

    await repository.createPayment({ orderId: "ord_01", method: "cash", amount: 60 });
    await repository.createPayment({ orderId: "ord_01", method: "card", amount: 40 });

    const payments = await repository.listPaymentsByOrder("ord_01");

    expect(payments).toHaveLength(2);
    expect(payments.map((p) => p.method).sort()).toEqual(["card", "cash"]);
  });

  it("solo devuelve los cobros del pedido pedido", async () => {
    const repository = new InMemoryPaymentRepository();

    await repository.createPayment({ orderId: "ord_01", method: "cash", amount: 100 });
    await repository.createPayment({ orderId: "ord_02", method: "cash", amount: 200 });

    const payments = await repository.listPaymentsByOrder("ord_02");

    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(200);
  });

  it("ordena los cobros por fecha de cobro", async () => {
    const repository = new InMemoryPaymentRepository();

    // Se insertan al revés a propósito: el orden de salida tiene que ser el de cobro, no el de alta.
    repository.payments.push(
      {
        id: "pay_2",
        orderId: "ord_01",
        method: "card",
        amount: 40,
        currency: null,
        changeAmount: 0,
        tip: 0,
        reference: null,
        createdAt: "2026-09-14T12:01:00.000Z",
      },
      {
        id: "pay_1",
        orderId: "ord_01",
        method: "cash",
        amount: 60,
        currency: null,
        changeAmount: 0,
        tip: 0,
        reference: null,
        createdAt: "2026-09-14T12:00:00.000Z",
      },
    );

    const payments = await repository.listPaymentsByOrder("ord_01");

    expect(payments.map((p) => p.id)).toEqual(["pay_1", "pay_2"]);
  });

  it("resume cantidad, monto y propina del pedido", async () => {
    const repository = new InMemoryPaymentRepository();

    await repository.createPayment({ orderId: "ord_01", method: "cash", amount: 60, tip: 6 });
    await repository.createPayment({ orderId: "ord_01", method: "card", amount: 40, tip: 4 });
    await repository.createPayment({ orderId: "ord_02", method: "cash", amount: 999 });

    const summary = await repository.getPaymentSummary("ord_01");

    expect(summary).toEqual({ count: 2, totalAmount: 100, totalTip: 10 });
  });

  it("un pedido sin cobros resume en cero", async () => {
    const repository = new InMemoryPaymentRepository();

    expect(await repository.getPaymentSummary("ord_sin_cobros")).toEqual({
      count: 0,
      totalAmount: 0,
      totalTip: 0,
    });
  });

  it("redondea el monto y la propina a dos decimales", async () => {
    const repository = new InMemoryPaymentRepository();

    const payment = await repository.createPayment({
      orderId: "ord_01",
      method: "cash",
      amount: 33.333,
      tip: 3.335,
    });

    expect(payment.amount).toBe(33.33);
    expect(payment.tip).toBe(3.34);
  });
});
