import { describe, expect, it, vi } from "vitest";

import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";

import { addPosLine, createPosDraft } from "../../domain/pos-draft";
import { PosError } from "../../domain/pos-errors";
import { commitSale } from "./commit-sale";
import type { PosSaleTransactionScope, RegisterPosSaleInput } from "./register-pos-sale";

/**
 * TASK-AUD-004 — **lo que la venta escribe**, con dobles.
 *
 * Este archivo existe porque el caso de uso se partió en dos: `register-pos-sale.ts` decide, valida y
 * cotiza; `commit-sale.ts` escribe. Acá se fija la parte que se movió, que es la que hoy corre adentro de
 * la transacción:
 *
 * - los cobros se escriben **todos**, con su moneda normalizada, su vuelto y el turno que los firma;
 * - el vuelto solo se anuncia en un cobro único en efectivo (en un pago mixto se mentiría);
 * - un reintento **no vuelve a cobrar**: devuelve lo que ya estaba guardado;
 * - si el total real del alta ya no cubre el cobro, corta **antes** de escribir ningún cobro.
 *
 * La atomicidad en sí (que un fallo a mitad no deje nada) no se prueba acá: un doble en memoria no puede
 * fallar como falla la base. Está en `register-pos-sale.postgres.test.ts`, contra PostgreSQL real.
 */

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

function saleInput(
  payments: RegisterPosSaleInput["payments"],
): RegisterPosSaleInput {
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
  const createPayment = vi.spyOn(paymentRepository, "createPayment");
  // TASK-AUD-005: el turno se bloquea y sigue abierto (la carrera real va contra PostgreSQL).
  const lockShift = vi.fn(async (shiftId: string) => ({ id: shiftId, status: "open" }));
  const scope: PosSaleTransactionScope = { createPosOrder, paymentRepository, lockShift };

  return { scope, createPosOrder, createPayment, paymentRepository, lockShift };
}

describe("commitSale", () => {
  /**
   * TASK-AUD-005 — el turno se cierra mientras se cobra.
   *
   * Es el otro lado de la carrera: la caja se cerró entre que el mostrador resolvió el turno abierto y la
   * venta entró a su transacción. Antes el cobro se escribía igual, firmado con un turno **cerrado**: esa
   * plata no entraba a ningún arqueo (el cierre ya había leído los cobros) y el documento firmado no la
   * explicaba. Ahora la venta se rechaza y no se escribe nada.
   */
  it("si el turno se cerró mientras se cobraba, rechaza la venta sin escribir", async () => {
    const { scope, createPosOrder, createPayment } = setup();
    scope.lockShift = async (shiftId) => ({ id: shiftId, status: "closed" });

    await expect(
      commitSale({
        input: saleInput([{ method: "cash", amount: 80, currency: "NIO" }]),
        couponCode: null,
        paidInBusinessCurrency: 80,
        openShift: { id: "shift_01" },
        scope,
        businessCurrencyCode: "NIO",
        usdExchangeRate: 36.5,
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    expect(createPosOrder).not.toHaveBeenCalled();
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("escribe todos los cobros con su moneda normalizada, su vuelto y el turno que los firma", async () => {
    const { scope, createPayment } = setup();

    const result = await commitSale({
      input: saleInput([{ method: "cash", amount: 100, currency: "nio" }]),
      couponCode: null,
      paidInBusinessCurrency: 100,
      openShift: { id: "shift_01" },
      scope,
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(createPayment).toHaveBeenCalledTimes(1);
    expect(result.payments).toHaveLength(1);
    // El vuelto sale del total real del pedido (80), no de lo que declaró el cajero.
    expect(result.payments[0]).toMatchObject({
      orderId: "ord_01",
      method: "cash",
      amount: 100,
      currency: "NIO",
      changeAmount: 20,
    });
    expect(result.change).toBe(20);
    expect(result.reused).toBe(false);
    // El cobro queda firmado con la caja abierta: es lo que permite que dos cajas del mismo local no se
    // cuenten la plata de la otra.
    expect((scope.paymentRepository as InMemoryPaymentRepository).paymentShifts.pay_1).toBe("shift_01");
  });

  it("en un pago mixto no anuncia vuelto en ninguna parte", async () => {
    const { scope } = setup();

    const result = await commitSale({
      input: saleInput([
        { method: "cash", amount: 50, currency: "NIO" },
        { method: "card", amount: 30, currency: "NIO" },
      ]),
      couponCode: null,
      paidInBusinessCurrency: 80,
      openShift: { id: "shift_01" },
      scope,
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(result.payments.map((payment) => payment.changeAmount)).toEqual([0, 0]);
    expect(result.change).toBe(0);
  });

  it("un reintento no vuelve a cobrar: devuelve lo que ya estaba guardado", async () => {
    const { scope, createPayment, paymentRepository } = setup(order(), true);
    // El cobro del primer intento, ya guardado (se escribe la fila, no se llama al repositorio: lo que se
    // mide es que este intento NO vuelva a cobrar).
    paymentRepository.payments.push({
      id: "pay_previo",
      orderId: "ord_01",
      method: "cash",
      amount: 80,
      currency: "NIO",
      changeAmount: 0,
      tip: 0,
      reference: null,
      createdAt: "2026-09-14T12:00:00.000Z",
    });

    const result = await commitSale({
      input: saleInput([{ method: "cash", amount: 80, currency: "NIO" }]),
      couponCode: null,
      paidInBusinessCurrency: 80,
      openShift: { id: "shift_01" },
      scope,
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(createPayment).not.toHaveBeenCalled();
    expect(result.reused).toBe(true);
    expect(result.payments).toHaveLength(1);
    expect(result.paidInBusinessCurrency).toBe(80);
  });

  it("si el total real del alta ya no cubre el cobro, corta sin escribir ningún cobro", async () => {
    // El menú cambió entre que el cajero cargó el catálogo y cobró: el pedido salió con 100 y el cobro era
    // de 80. El error tiene que decir la diferencia y **no** puede quedar el pedido sin cobros: por eso
    // esta salida lanza adentro de la transacción (TASK-AUD-004).
    const { scope, createPayment } = setup(order({ total: 100 }));

    await expect(
      commitSale({
        input: saleInput([{ method: "cash", amount: 80, currency: "NIO" }]),
        couponCode: null,
        paidInBusinessCurrency: 80,
        openShift: { id: "shift_01" },
        scope,
        businessCurrencyCode: "NIO",
        usdExchangeRate: 36.5,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
      fields: { payments: "Faltan cobrar 20" },
    } satisfies Partial<PosError>);

    expect(createPayment).not.toHaveBeenCalled();
  });

  it("le pide el alta al alta con los datos del cliente, sin propina y con lo que puso el cliente", async () => {
    const { scope, createPosOrder } = setup();

    await commitSale({
      input: {
        ...saleInput([{ method: "cash", amount: 80, currency: "NIO" }]),
        customer: {
          name: "Cliente Mostrador",
          whatsapp: "88887777",
          email: "cliente@ejemplo.com",
          taxId: "001-000000-0001",
          legalName: "Cliente Mostrador S.A.",
        },
        couponCode: "PROMO10",
        idempotencyKey: "clave-1",
      },
      couponCode: "PROMO10",
      paidInBusinessCurrency: 80,
      openShift: { id: "shift_01" },
      scope,
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
    });

    expect(createPosOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pickup",
        customerEmail: "cliente@ejemplo.com",
        customerTaxId: "001-000000-0001",
        customerLegalName: "Cliente Mostrador S.A.",
        tipOptIn: false,
        couponCode: "PROMO10",
        idempotencyKey: "clave-1",
        // Efectivo: viaja con cuánto paga el cliente (con tarjeta viaja `null`).
        paidWithAmount: 80,
      }),
    );
  });
});
