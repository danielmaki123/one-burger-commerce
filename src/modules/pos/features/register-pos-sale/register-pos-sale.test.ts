import { describe, expect, it, vi } from "vitest";

import type { OrderRecord } from "@/modules/orders/domain/order.types";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";

import { addPosLine, createPosDraft, type PosDraft } from "../../domain/pos-draft";
import { PosError } from "../../domain/pos-errors";
import { registerPosSale } from "./register-pos-sale";

/**
 * TASK-303b — la venta de mostrador de punta a punta (sin base de datos).
 *
 * Lo que se fija acá, que es lo que puede salir caro:
 * - el alta pasa por `createOrder` con los datos del cliente (correo incluido) y sin propina;
 * - los cobros se registran **con su moneda** (el arqueo necesita saber si entró un dólar);
 * - un cobro que no alcanza **no crea el pedido**, y si el total cambió entre el catálogo y el cobro
 *   el error dice el número de pedido en vez de registrar un cobro que no cubre la venta.
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

function draftWithTaco(): PosDraft {
  return addPosLine(createPosDraft("loc_centro"), {
    productId: "prod_taco",
    name: "Taco de birria",
    unitPrice: 35,
    packagingUnitAmount: 5,
    quantity: 2,
  });
}

function setup(
  createPosOrder = vi.fn(async () => order()),
  findOpenShift: () => Promise<{ id: string } | null> = async () => ({ id: "shift_01" }),
) {
  const paymentRepository = new InMemoryPaymentRepository();

  return {
    createPosOrder,
    paymentRepository,
    deps: {
      createPosOrder,
      paymentRepository,
      businessCurrencyCode: "NIO",
      usdExchangeRate: 36.5,
      findOpenShift,
    },
  };
}

const customer = { name: "Cliente Mostrador", whatsapp: "88887777", email: "cliente@ejemplo.com" };

describe("venta de mostrador", () => {
  /**
   * Bloque 9.2 del roadmap del POS (Fase 2) — sin caja abierta no se cobra.
   *
   * Un cobro con la caja cerrada se registraba igual: el `Payment` quedaba en la base y el turno que
   * lo explica no existía, así que esa plata no entraba a ningún arqueo. Ahora corta **antes** de
   * crear el pedido, con el motivo en español que la pantalla muestra.
   */
  it("sin caja abierta no cobra y no crea el pedido", async () => {
    const { createPosOrder, paymentRepository, deps } = setup(undefined, async () => null);

    await expect(
      registerPosSale(
        { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 80 }] },
        deps,
      ),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    expect(createPosOrder).not.toHaveBeenCalled();
    expect(await paymentRepository.listPaymentsByOrder("ord_01")).toHaveLength(0);
  });

  it("crea el pedido con el cliente y el correo, y registra el cobro en córdobas", async () => {
    const { createPosOrder, paymentRepository, deps } = setup();

    const result = await registerPosSale(
      { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 80 }] },
      deps,
    );

    expect(createPosOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pickup",
        customerName: "Cliente Mostrador",
        customerWhatsapp: "88887777",
        customerEmail: "cliente@ejemplo.com",
        tipOptIn: false,
        pickupScheduled: false,
        items: [
          { productId: "prod_taco", quantity: 2, modifierOptionIds: [], notes: null },
        ],
      }),
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ method: "cash", amount: 80, currency: "NIO" });

    expect(result.paidInBusinessCurrency).toBe(80);
    expect(result.change).toBe(0);
    expect(result.order.orderNumber).toBe("P-ABC123");
  });

  /**
   * Bloque 4 del roadmap del POS (Fase 2) — el cobro partido y la transferencia.
   *
   * El contrato ya aceptaba N cobros y el caso de uso los registraba uno por uno, pero **el POS no
   * tenía forma de armar dos** (un monto, un método). Lo que se fija acá:
   * - dos cobros del mismo pedido se registran cada uno con **su** método, su monto y su moneda
   *   (efectivo + transferencia, o dos tarjetas);
   * - el **vuelto solo sale del efectivo**: en un pago partido con tarjeta no hay cambio que dar, así
   *   que el `changeAmount` del cobro queda en 0 y el arqueo no descuenta plata que nadie entregó.
   */
  it("registra un cobro partido: efectivo + transferencia, cada uno con su medio", async () => {
    const { createPosOrder, paymentRepository, deps } = setup();

    const result = await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        // La venta es de 80: 30 en efectivo y 50 por transferencia.
        payments: [
          { method: "cash", currency: "NIO", amount: 30 },
          { method: "transfer", currency: "NIO", amount: 50 },
        ],
      },
      deps,
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments).toHaveLength(2);
    expect(payments[0]).toMatchObject({ method: "cash", amount: 30 });
    expect(payments[1]).toMatchObject({ method: "transfer", amount: 50 });

    // El pedido declara la forma del **primer** cobro: el detalle real está en los cobros.
    expect(createPosOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: "cash", paidWithAmount: 80 }),
    );
    expect(result.change).toBe(0);
  });

  it("en un cobro partido no se registra vuelto en ningún cobro", async () => {
    const { paymentRepository, deps } = setup();

    const result = await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        // Paga 100 (50 efectivo + 50 tarjeta) por una venta de 80: hay 20 de más, pero no salen del
        // cajón como vuelto porque el efectivo solo cubrió 50.
        payments: [
          { method: "cash", currency: "NIO", amount: 50 },
          { method: "card", currency: "NIO", amount: 50 },
        ],
      },
      deps,
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments.map((payment) => payment.changeAmount)).toEqual([0, 0]);
    // **El vuelto no aplica en un cobro partido**: el cliente paga la parte de efectivo exacta (si
    // sobrara, se habría cobrado de menos por el otro medio), así que el POS no anuncia cambio.
    expect(result.change).toBe(0);
  });

  it("con dos cobros de tarjeta tampoco hay vuelto", async () => {
    const { paymentRepository, deps } = setup();

    const result = await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        payments: [
          { method: "card", currency: "NIO", amount: 40 },
          { method: "card", currency: "NIO", amount: 40 },
        ],
      },
      deps,
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments).toHaveLength(2);
    expect(payments.every((payment) => payment.changeAmount === 0)).toBe(true);
    expect(result.change).toBe(0);
  });

  it("cobra en dólares: registra la moneda original y calcula el cambio convertido", async () => {    const { paymentRepository, deps } = setup();

    const result = await registerPosSale(
      // 3 dólares × 36.5 = 109.50 por una venta de 80: el cambio son 29.50 en moneda del negocio.
      { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "usd", amount: 3 }] },
      deps,
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments[0]).toMatchObject({ amount: 3, currency: "USD" });
    expect(result.paidInBusinessCurrency).toBe(109.5);
    expect(result.change).toBe(29.5);
  });

  it("deja registrado el vuelto que salió del cajón (TASK-305)", async () => {
    const { createPosOrder, paymentRepository, deps } = setup();

    // El pedido guarda lo que el cliente puso (para el detalle y el arqueo)…
    await registerPosSale(
      { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 100 }] },
      deps,
    );

    expect(createPosOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paidWithAmount: 100 }),
    );

    // …y el cobro en efectivo guarda el vuelto (20), que es lo que el arqueo descuenta del cajón.
    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments[0].changeAmount).toBe(20);
  });

  it("en un pago mixto el vuelto queda en 0: lo explica la caja al cerrar (TASK-305)", async () => {
    const { paymentRepository, deps } = setup();

    await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        payments: [
          { method: "cash", currency: "NIO", amount: 50 },
          { method: "card", currency: "NIO", amount: 30 },
        ],
      },
      deps,
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments.map((payment) => payment.changeAmount)).toEqual([0, 0]);
  });

  it("un pago mixto deja un cobro por medio", async () => {
    const { paymentRepository, deps } = setup();

    await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        payments: [
          { method: "cash", currency: "NIO", amount: 50 },
          { method: "card", currency: "NIO", amount: 30 },
        ],
      },
      deps,
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments.map((payment) => payment.method)).toEqual(["cash", "card"]);
  });

  it("un cobro que no alcanza no crea nada", async () => {
    const { createPosOrder, paymentRepository, deps } = setup();

    await expect(
      registerPosSale(
        { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 50 }] },
        deps,
      ),
    ).rejects.toBeInstanceOf(PosError);

    expect(createPosOrder).not.toHaveBeenCalled();
    expect(await paymentRepository.listPaymentsByOrder("ord_01")).toHaveLength(0);
  });

  it("si el total cambió al crear el pedido, lo dice con el número y no registra el cobro", async () => {
    // El menú cambió entre que el cajero cargó el catálogo y cobró: el total real es mayor.
    const { createPosOrder, paymentRepository, deps } = setup(
      vi.fn(async () => order({ total: 95 })),
    );

    await expect(
      registerPosSale(
        { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 80 }] },
        deps,
      ),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("P-ABC123") });

    expect(createPosOrder).toHaveBeenCalledTimes(1);
    expect(await paymentRepository.listPaymentsByOrder("ord_01")).toHaveLength(0);
  });

  it("sin productos no hay venta", async () => {
    const { createPosOrder, deps } = setup();

    await expect(
      registerPosSale(
        {
          draft: createPosDraft("loc_centro"),
          customer,
          payments: [{ method: "cash", currency: "NIO", amount: 100 }],
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(PosError);

    expect(createPosOrder).not.toHaveBeenCalled();
  });
});
