import { describe, expect, it, vi } from "vitest";

import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";

import { registerOrderPayment } from "./register-order-payment";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — **cobrar un pedido que ya existe**.
 *
 * Un pedido del menú público se paga al retirar: no crea `Payment` (no hay pasarela), y sin cobros no se
 * puede facturar. Esto registra ese cobro sobre el pedido, con las guardas que evitan los dos errores caros:
 * cobrar dos veces el mismo pedido y cobrar más de lo que vale.
 */

function order(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "ord_01",
    orderNumber: "P-MUDF8E1K",
    locationId: "loc_principal",
    status: "new",
    total: 280,
    type: "pickup",
    ...overrides,
  } as OrderRecord;
}

function setup(input: { order?: OrderRecord | null; payments?: number } = {}) {
  const paymentRepository = new InMemoryPaymentRepository();
  const orderRepository = {
    findOrderById: vi.fn(async () => (input.order === undefined ? order() : input.order)),
  };
  const findOpenShift = vi.fn(async () => ({ id: "shift_01" }));

  for (let index = 0; index < (input.payments ?? 0); index += 1) {
    paymentRepository.payments.push({
      id: `pay_${index + 1}`,
      orderId: "ord_01",
      method: "cash",
      amount: 280,
      currency: null,
      changeAmount: 0,
      tip: 0,
      reference: null,
      createdAt: new Date().toISOString(),
      voidedAt: null,
      voidedByUserId: null,
      voidReason: null,
    });
  }

  return {
    paymentRepository,
    orderRepository,
    findOpenShift,
    deps: {
      orderRepository,
      paymentRepository,
      findOpenShift,
      /**
       * TASK-AUD-005 — el doble del límite atómico: corre el trabajo con los mismos dobles y con el turno
       * abierto. La carrera real contra el cierre se prueba contra PostgreSQL.
       */
      runInOrderPaymentTransaction: <T,>(
        work: (scope: {
          paymentRepository: typeof paymentRepository;
          lockOrder: (orderId: string) => Promise<{ id: string } | null>;
          lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
        }) => Promise<T>,
      ) =>
        work({
          paymentRepository,
          // TASK-AUD-055: el doble del lock del pedido (la concurrencia real va contra PostgreSQL).
          lockOrder: async (orderId: string) => ({ id: orderId }),
          lockShift: async (shiftId: string) => ({ id: shiftId, status: "open" }),
        }),
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    },
  };
}

describe("registerOrderPayment", () => {
  /**
   * TASK-AUD-005 — el turno se cierra mientras se cobra.
   *
   * Es el **segundo** camino que le firma el turno a un `Payment` (el primero es la venta del mostrador). Con
   * la caja cerrada en el medio, el cobro se rechaza: si se firmara con el turno cerrado, esa plata no
   * entraría a ningún arqueo (el corte X del turno siguiente solo lee los cobros **atribuidos**) y el
   * documento firmado no la explicaría.
   */
  it("si el turno se cerró mientras se cobraba, rechaza el cobro sin registrarlo", async () => {
    const { deps, paymentRepository } = setup();

    deps.runInOrderPaymentTransaction = <T,>(
      work: (scope: {
        paymentRepository: typeof paymentRepository;
        lockOrder: (orderId: string) => Promise<{ id: string } | null>;
        lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
      }) => Promise<T>,
    ) =>
      work({
        paymentRepository,
        lockOrder: async (orderId: string) => ({ id: orderId }),
        lockShift: async (shiftId: string) => ({ id: shiftId, status: "closed" }),
      });

    await expect(
      registerOrderPayment(
        { orderId: "ord_01", method: "cash", amount: 280, currency: "NIO" },
        deps,
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("registra el cobro del pedido con su moneda y lo atribuye al turno abierto", async () => {
    const { deps, findOpenShift } = setup();

    const result = await registerOrderPayment(
      {
        orderId: "ord_01",
        method: "cash",
        amount: 280,
        currency: "nio",
        reference: "voucher-1",
        terminalId: "term_caja_1",
      },
      deps,
    );

    expect(result.data).toMatchObject({
      orderId: "ord_01",
      method: "cash",
      amount: 280,
      currency: "NIO",
      reference: "voucher-1",
    });
    expect(findOpenShift).toHaveBeenCalledWith("loc_principal", "term_caja_1");
    expect(await deps.paymentRepository.listPaymentsByShift("shift_01")).toHaveLength(1);
  });

  it("sin turno abierto el cobro se registra igual, sin turno (no se pierde la venta)", async () => {
    const { deps } = setup();
    deps.findOpenShift = vi.fn(async () => null) as never;

    const result = await registerOrderPayment(
      { orderId: "ord_01", method: "cash", amount: 280, currency: "NIO" },
      deps,
    );

    expect(result.data.amount).toBe(280);
    expect(await deps.paymentRepository.listPaymentsByShift("shift_01")).toHaveLength(0);
  });

  it("un pedido que no existe devuelve 404", async () => {
    const { deps } = setup({ order: null });

    await expect(
      registerOrderPayment({ orderId: "ord_x", method: "cash", amount: 10, currency: "NIO" }, deps),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("un pedido cancelado no se cobra", async () => {
    const { deps } = setup({ order: order({ status: "cancelled" }) });

    await expect(
      registerOrderPayment({ orderId: "ord_01", method: "cash", amount: 280, currency: "NIO" }, deps),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("cancelado") });
  });

  it("un pedido ya cobrado no se cobra dos veces", async () => {
    const { deps } = setup({ payments: 1 });

    await expect(
      registerOrderPayment({ orderId: "ord_01", method: "cash", amount: 280, currency: "NIO" }, deps),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("ya está cobrado") });
  });

  it("un cobro que pasa el total del pedido se rechaza (no se cobra de más)", async () => {
    const { deps } = setup();

    await expect(
      registerOrderPayment({ orderId: "ord_01", method: "cash", amount: 300, currency: "NIO" }, deps),
    ).rejects.toMatchObject({
      status: 409,
      fields: { amount: expect.stringContaining("pasa el total") },
    });
  });

  it("un monto que no es un número positivo se rechaza con el campo señalado", async () => {
    const { deps } = setup();

    await expect(
      registerOrderPayment({ orderId: "ord_01", method: "cash", amount: 0, currency: "NIO" }, deps),
    ).rejects.toMatchObject({ status: 422, fields: { amount: expect.any(String) } });
  });
});
