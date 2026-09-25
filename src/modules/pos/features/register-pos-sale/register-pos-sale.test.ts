import { describe, expect, it, vi } from "vitest";

import type { OrderRecord } from "@/modules/orders/domain/order.types";
import type { CreateOrderRequest } from "@/modules/orders/features/create-order/create-order";
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
  createPosOrder = vi.fn(async (_input: CreateOrderRequest) => ({
    order: order(),
    reused: false,
  })),
  findOpenShift: (
    locationId: string,
    terminalId?: string | null,
  ) => Promise<{ id: string } | null> = async () => ({ id: "shift_01" }),
) {
  const paymentRepository = new InMemoryPaymentRepository();

  return {
    createPosOrder,
    paymentRepository,
    deps: {
      /**
       * TASK-AUD-004 — el doble de la unidad de trabajo: corre el trabajo con los mismos dobles y sin
       * transacción (el rollback real se prueba contra PostgreSQL). Lo que fija acá es que el caso de uso
       * **escriba todo adentro**, no cómo se abre la transacción.
       */
      runInSaleTransaction: <T,>(work: (scope: {
        createPosOrder: typeof createPosOrder;
        paymentRepository: InMemoryPaymentRepository;
        lockShift: (shiftId: string) => Promise<{ id: string; status: string } | null>;
      }) => Promise<T>) =>
        work({
          createPosOrder,
          paymentRepository,
          /**
           * TASK-AUD-005 — el doble del bloqueo del turno: abierto. Lo que fija este archivo es que el caso
           * de uso **consulte** el bloqueo antes de escribir; la carrera real (un cierre en el medio) se
           * prueba contra PostgreSQL, en `close-shift.postgres.test.ts` y en los tests de la venta.
           */
          lockShift: async (shiftId) => ({ id: shiftId, status: "open" }),
        }),
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

  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — el cobro queda **firmado con su turno**.
   *
   * Es lo que permite que dos cajas abiertas en el mismo local (una por terminal) no se cuenten la misma
   * plata: el arqueo de cada turno lee sus cobros por `Payment.shiftId`. Y la terminal del POS manda: si el
   * local tiene dos, el turno que se firma es el de **esa** terminal.
   */
  it("firma cada cobro con el turno de su terminal", async () => {
    const { paymentRepository, deps } = setup(undefined, async (_locationId, terminalId) => ({
      id: terminalId === "term_barra" ? "shift_barra" : "shift_caja_1",
    }));

    await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        payments: [{ method: "cash", currency: "NIO", amount: 80 }],
        terminalId: "term_barra",
      },
      deps,
    );

    const [payment] = await paymentRepository.listPaymentsByOrder("ord_01");

    expect(paymentRepository.paymentShifts[payment.id]).toBe("shift_barra");
    expect(await paymentRepository.listPaymentsByShift("shift_caja_1")).toHaveLength(0);
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
   * Los modificadores que el cajero eligió son parte de la venta: el alta los valida y **cotiza** la
   * línea (`basePrice + Σ priceDelta`). Antes viajaba `[]` fijo, así que cualquier producto con un grupo
   * obligatorio —la mitad de la carta real— no se podía cobrar desde el mostrador (422 del alta).
   */
  it("manda al alta los modificadores elegidos en la línea", async () => {
    const { createPosOrder, deps } = setup();

    await registerPosSale(
      {
        draft: addPosLine(createPosDraft("loc_centro"), {
          productId: "prod_doble",
          name: "DOBLE",
          unitPrice: 80,
          modifierOptionIds: ["opt_papas"],
          modifierNames: ["PAPAS FRITAS"],
        }),
        customer,
        payments: [{ method: "cash", currency: "NIO", amount: 80 }],
      },
      deps,
    );

    expect(createPosOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            productId: "prod_doble",
            quantity: 1,
            modifierOptionIds: ["opt_papas"],
            notes: null,
          },
        ],
      }),
    );
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

  /**
   * Tarea 10 del brief (2026-09-17) — **cobrar con tarjeta estaba roto**.
   *
   * El «con cuánto paga» viajaba siempre al alta del pedido, y `createOrder` lo rechaza cuando la forma
   * declarada no es efectivo («El vuelto solo se calcula cuando pagás en efectivo»): **toda** venta con
   * tarjeta del mostrador terminaba en 400. Los tests de este caso de uso no lo veían porque doblan
   * `createPosOrder`; se encontró cobrando con tarjeta de verdad para la conciliación (11.1/11.2).
   *
   * Lo que se fija: con tarjeta el monto no viaja (la terminal cobra el total exacto) y el cobro sigue
   * cubriendo el total, que es la otra mitad de la regla.
   */
  it("una venta con tarjeta no declara «con cuánto paga»", async () => {
    const { createPosOrder, paymentRepository, deps } = setup();

    const result = await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        payments: [
          { method: "card", currency: "NIO", amount: 80, reference: "VOUCHER-1" },
        ],
      },
      deps,
    );

    expect(createPosOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: "card", paidWithAmount: null }),
    );

    const payments = await paymentRepository.listPaymentsByOrder("ord_01");
    expect(payments[0]).toMatchObject({ method: "card", amount: 80 });
    expect(result.change).toBe(0);
  });

  /**
   * Tarea 11 del brief (2026-09-17) — **el reintento no registra los cobros dos veces** (12.1/12.2).
   *
   * El alta ya era idempotente: con la misma clave, `createOrder` devuelve el pedido que ya existía. Los
   * **cobros** no: se registraban en cada intento, así que un reintento después de un corte de red dejaba
   * el mismo pedido cobrado dos veces y el arqueo del turno contaba esa plata de más —el bug de plata que
   * este caso de uso tenía escondido detrás del anti doble submit de la pantalla—.
   */
  it("un reintento del mismo cobro no vuelve a registrar los pagos", async () => {
    const createPosOrder = vi.fn(async () => ({ order: order(), reused: true }));
    const { paymentRepository, deps } = setup(createPosOrder);

    // El cobro del primer intento, que sí llegó al servidor.
    await paymentRepository.createPayment({
      orderId: "ord_01",
      method: "cash",
      amount: 80,
      currency: "NIO",
      changeAmount: 0,
    });

    const result = await registerPosSale(
      { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 80 }], idempotencyKey: "op-abc" },
      deps,
    );

    expect(await paymentRepository.listPaymentsByOrder("ord_01")).toHaveLength(1);
    expect(result.reused).toBe(true);
    // La respuesta se arma con lo que ya estaba cobrado, no con lo que volvió a mandar la pantalla.
    expect(result.paidInBusinessCurrency).toBe(80);
    expect(result.payments).toHaveLength(1);
  });

  it("una venta nueva se marca como no reusada", async () => {
    const { deps } = setup();

    const result = await registerPosSale(
      { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 80 }] },
      deps,
    );

    expect(result.reused).toBe(false);
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
      vi.fn(async () => ({ order: order({ total: 95 }), reused: false })),
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

  /**
   * Tarea 9.6 del roadmap del POS (Fase 2) — el cupón que el cliente trajo.
   *
   * El cajero ya lo **cotizó** antes de cobrar (el descuento se le mostró al cliente), así que el cobro
   * tiene que pedir el total **con el descuento**: comparar contra el total sin cupón hacía que la venta se
   * rechazara por «no alcanza» aunque el cliente hubiera pagado bien. El código viaja al alta, que es la
   * única puerta que valida la elegibilidad, calcula el descuento y consume el uso.
   */
  it("un cupón cotizado descuenta lo que se le pide al cliente y viaja al alta", async () => {
    const createPosOrder = vi.fn(async (_input: CreateOrderRequest) => ({
      order: order({ subtotal: 70, discount: 7, packagingAmount: 10, total: 73 }),
      reused: false,
    }));
    const quoteCoupon = vi.fn(async () => ({
      coupon: {
        code: "BIENVENIDA10",
        type: "percentage" as const,
        value: 10,
        buyQuantity: null,
        freeQuantity: null,
        scopeType: null,
        scopeId: null,
      },
      subtotal: 70,
      discount: 7,
    }));
    const { deps } = setup(createPosOrder);

    const result = await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        // Con el cupón el cliente paga 73: sin el descuento, este cobro «no alcanzaría» (80).
        payments: [{ method: "cash", currency: "NIO", amount: 73 }],
        couponCode: "BIENVENIDA10",
      },
      { ...deps, quoteCoupon },
    );

    expect(quoteCoupon).toHaveBeenCalledWith({
      couponCode: "BIENVENIDA10",
      lines: [{ productId: "prod_taco", quantity: 2 }],
    });
    expect(createPosOrder).toHaveBeenCalledTimes(1);
    expect(createPosOrder.mock.calls[0][0]).toMatchObject({ couponCode: "BIENVENIDA10" });
    expect(result.order.total).toBe(73);
  });

  it("sin código de cupón no se cotiza nada y el alta no recibe cupón", async () => {
    const quoteCoupon = vi.fn();
    const { createPosOrder, deps } = setup();

    await registerPosSale(
      { draft: draftWithTaco(), customer, payments: [{ method: "cash", currency: "NIO", amount: 80 }] },
      { ...deps, quoteCoupon },
    );

    expect(quoteCoupon).not.toHaveBeenCalled();
    expect(createPosOrder.mock.calls[0][0]).toMatchObject({ couponCode: null });
  });

  /**
   * Tarea 9.7 del roadmap del POS (Fase 2) — el **descuento manual** autorizado.
   *
   * El permiso lo comprueba la ruta (`canDiscountPosSale`); acá lo que importa es que el descuento mueva el
   * total que se le pide al cliente **y** viaje al alta como forma y motivo, para que el monto lo calcule el
   * servidor y quede el porqué.
   */
  it("un descuento manual autorizado baja el total que se le pide al cliente", async () => {
    const createPosOrder = vi.fn(async (_input: CreateOrderRequest) => ({
      order: order({ subtotal: 70, discount: 7, packagingAmount: 10, total: 73 }),
      reused: false,
    }));
    const { deps } = setup(createPosOrder);

    const result = await registerPosSale(
      {
        draft: draftWithTaco(),
        customer,
        // 70 de taco + 10 de empaque − 10 % de 70 = 73.
        payments: [{ method: "cash", currency: "NIO", amount: 73 }],
        manualDiscount: { kind: "percentage", value: 10, reason: "Cliente de siempre" },
      },
      deps,
    );

    expect(createPosOrder.mock.calls[0][0]).toMatchObject({
      manualDiscount: { kind: "percentage", value: 10, reason: "Cliente de siempre" },
    });
    expect(result.order.total).toBe(73);
  });

  it("un descuento manual sin motivo no cobra nada", async () => {
    const { createPosOrder, deps } = setup();

    await expect(
      registerPosSale(
        {
          draft: draftWithTaco(),
          customer,
          payments: [{ method: "cash", currency: "NIO", amount: 80 }],
          manualDiscount: { kind: "amount", value: 10, reason: "   " },
        },
        deps,
      ),
    ).rejects.toMatchObject({ status: 422, message: "Escribí por qué se hace el descuento." });

    expect(createPosOrder).not.toHaveBeenCalled();
  });
});
