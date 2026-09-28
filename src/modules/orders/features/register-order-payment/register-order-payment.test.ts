import { describe, expect, it, vi } from "vitest";

import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";

import { registerOrderPayment, type OrderPaymentScope, type RegisterOrderPaymentInput } from "./register-order-payment";
import { InMemoryPaymentLookup } from "@/modules/payments/adapters/in-memory-payment-lookup";

/**
 * Hallazgo N3 de la auditoría post-deploy (2026-09-23) — **cobrar un pedido que ya existe**.
 *
 * Un pedido del menú público se paga al retirar: no crea `Payment` (no hay pasarela), y sin cobros no se
 * puede facturar. Esto registra ese cobro sobre el pedido, con las guardas que evitan los dos errores caros:
 * cobrar dos veces el mismo pedido y cobrar más de lo que vale.
 *
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` le cambió cuatro cosas, y cada una tiene su test más abajo:
 *
 * 1. **`A-68`** — el tope se compara contra el **equivalente en moneda base** de cada cobro, no contra la
 *    suma cruda. Antes, un pedido de C$365 aceptaba un cobro de US$10 como «10 pagados» y dejaba cobrar
 *    otros C$355.
 * 2. **`A-71`** — el cobro tiene **clave de idempotencia**: el mismo request repetido devuelve el mismo
 *    `Payment` en vez de registrar la misma plata dos veces.
 * 3. **`A-75`** — el tope se compara contra el total **leído dentro del lock**.
 * 4. **`D-020`** — el cobro **congela su snapshot** (monto, moneda, moneda base, tasa y equivalente).
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

/** El payload con la clave que ahora exige el cobro (la manda el cliente). */
function payload(over: Partial<RegisterOrderPaymentInput> = {}): RegisterOrderPaymentInput {
  return { orderId: "ord_01", method: "cash", amount: 280, currency: "NIO", idempotencyKey: "key_1", ...over };
}

/** Un cobro persistido. Los campos del snapshot son opcionales para poder armar un cobro legacy. */
function storedPayment(over: Record<string, unknown>) {
  return {
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
    baseCurrencyCode: null,
    exchangeRate: null,
    baseAmount: null,
    paymentMethodId: null,
    methodKind: null,
    entityId: null,
    idempotencyKey: null,
    ...over,
  } as never;
}

function setup(
  input: {
    order?: OrderRecord | null;
    payments?: number;
    stored?: Array<Record<string, unknown>>;
    openShift?: null;
  } = {},
) {
  const paymentRepository = new InMemoryPaymentRepository();
  const paymentLookup = new InMemoryPaymentLookup(paymentRepository);
  const currentOrder = () => (input.order === undefined ? order() : input.order);
  const scope = {
    paymentRepository: {
      createPayment: (payment: Parameters<InMemoryPaymentRepository["createPayment"]>[0]) =>
        paymentRepository.createPayment(payment),
      listPaymentsByOrder: (orderId: string) => paymentRepository.listPaymentsByOrder(orderId),
    },
    /** `A-71` — el reintento con la misma clave devuelve el cobro que ya existe. */
    findPaymentByIdempotencyKey: (key: string) => paymentLookup.findPaymentByIdempotencyKey(key),
    /**
     * `A-75` — el lock devuelve **el pedido bloqueado**: el caso de uso usa **ese** total para el tope.
     * Comparar contra el que se leyó antes de abrir la transacción es usar un número viejo.
     */
    lockOrder: vi.fn(async (orderId: string) => {
      const locked = currentOrder();
      return locked ? { id: orderId, total: locked.total } : null;
    }),
    lockShift: vi.fn(async (shiftId: string) => ({ id: shiftId, status: "open" })),
  };

  const orderRepository = {
    findOrderById: vi.fn(async () => currentOrder()),
    lockOrderForPayment: scope.lockOrder,
  };
  const findOpenShift = vi.fn(async () => (input.openShift === null ? null : { id: "shift_01" }));

  for (let index = 0; index < (input.payments ?? 0); index += 1) {
    paymentRepository.payments.push(storedPayment({ id: `pay_${index + 1}`, amount: 280 }));
  }

  for (const stored of input.stored ?? []) {
    paymentRepository.payments.push(storedPayment(stored));
  }

  return {
    paymentRepository,
    orderRepository,
    findOpenShift,
    scope,
    deps: {
      orderRepository,
      paymentRepository,
      findOpenShift,
      /**
       * TASK-AUD-005 — el doble del límite atómico: corre el trabajo con los mismos dobles y con el turno
       * abierto. La carrera real contra el cierre se prueba contra PostgreSQL.
       */
      runInOrderPaymentTransaction: <T,>(
        work: (scope: OrderPaymentScope) => Promise<T>,
      ) => Promise.resolve(work(scope)),
      baseCurrencyCode: "NIO",
      rates: { USD: 36.5 } as Record<string, number | null | undefined>,
      paymentMethodKind: "cash" as const,
    } as never as Parameters<typeof registerOrderPayment>[1],
  };
}

describe("registerOrderPayment", () => {
  it("si el turno se cerró mientras se cobraba, rechaza el cobro sin registrarlo", async () => {
    const { deps, scope, paymentRepository } = setup();

    scope.lockShift = vi.fn(async (shiftId: string) => ({ id: shiftId, status: "closed" }));

    await expect(registerOrderPayment(payload(), deps)).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });

    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("registra el cobro del pedido con su moneda y lo atribuye al turno abierto", async () => {
    const { deps, findOpenShift } = setup();

    const result = await registerOrderPayment(
      payload({ reference: "voucher-1", terminalId: "term_caja_1" }),
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
    expect(await paymentRepositoryOf(deps).listPaymentsByShift("shift_01")).toHaveLength(1);
  });

  it("sin turno abierto el cobro se registra igual, sin turno (no se pierde la venta)", async () => {
    const { deps, paymentRepository } = setup({ openShift: null });

    const result = await registerOrderPayment(payload(), deps);

    expect(result.data.amount).toBe(280);
    expect(await paymentRepository.listPaymentsByShift("shift_01")).toHaveLength(0);
  });

  it("un pedido que no existe devuelve 404", async () => {
    const { deps } = setup({ order: null });

    await expect(
      registerOrderPayment(payload({ orderId: "ord_x", amount: 10 }), deps),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("un pedido cancelado no se cobra", async () => {
    const { deps } = setup({ order: order({ status: "cancelled" }) });

    await expect(registerOrderPayment(payload(), deps)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("cancelado"),
    });
  });

  it("un pedido ya cobrado no se cobra dos veces", async () => {
    const { deps } = setup({ payments: 1 });

    await expect(registerOrderPayment(payload(), deps)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("ya está cobrado"),
    });
  });

  it("un cobro que pasa el total del pedido se rechaza (no se cobra de más)", async () => {
    const { deps } = setup();

    await expect(registerOrderPayment(payload({ amount: 300 }), deps)).rejects.toMatchObject({
      status: 409,
      fields: { amount: expect.stringContaining("pasa el total") },
    });
  });

  it("un monto que no es un número positivo se rechaza con el campo señalado", async () => {
    const { deps } = setup();

    await expect(registerOrderPayment(payload({ amount: 0 }), deps)).rejects.toMatchObject({
      status: 422,
      fields: { amount: expect.any(String) },
    });
  });

  it("un cobro sin clave de idempotencia se rechaza con el campo señalado", async () => {
    const { deps } = setup();

    await expect(registerOrderPayment(payload({ idempotencyKey: "" }), deps)).rejects.toMatchObject({
      status: 422,
      fields: { idempotencyKey: expect.any(String) },
    });
  });
});

describe("registerOrderPayment — A-68: el tope se mide en moneda base", () => {
  it("un cobro en dólares cubre su equivalente y NO deja cobrar el resto en córdobas", async () => {
    // El caso textual del hallazgo: US$10 × 36.5 = C$365 sobre un pedido de C$365. Antes este request
    // pasaba y después entraban otros C$355: sobre-cobro de C$355.
    const { deps, paymentRepository } = setup({ order: order({ total: 365 }) });

    const result = await registerOrderPayment(
      payload({ amount: 10, currency: "USD", idempotencyKey: "key_usd" }),
      deps,
    );

    expect(result.data).toMatchObject({ amount: 10, currency: "USD", baseAmount: 365, exchangeRate: 36.5 });

    await expect(
      registerOrderPayment(payload({ amount: 355, idempotencyKey: "key_nio" }), deps),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("ya está cobrado") });

    expect(paymentRepository.payments).toHaveLength(1);
  });

  it("rechaza el cobro cuyo EQUIVALENTE pasa el total, aunque el monto nominal no lo pase", async () => {
    // US$10 sobre un pedido de C$280: el monto (10) es menor que el total (280); el equivalente (365) no.
    const { deps } = setup({ order: order({ total: 280 }) });

    await expect(
      registerOrderPayment(payload({ amount: 10, currency: "USD" }), deps),
    ).rejects.toMatchObject({
      status: 409,
      fields: { amount: expect.stringContaining("pasa el total") },
    });
  });

  it("sin tasa para la moneda del cobro rechaza en vez de comparar montos crudos", async () => {
    const { deps } = setup();
    (deps as unknown as { rates: Record<string, number | null> }).rates = {};

    await expect(
      registerOrderPayment(payload({ amount: 10, currency: "USD" }), deps),
    ).rejects.toMatchObject({
      status: 409,
      fields: { currency: expect.stringContaining("tasa") },
    });
  });

  it("un cobro legacy en moneda extranjera no se re-interpreta con la tasa vigente (D-020)", async () => {
    // El saldo suma el **snapshot** de cada cobro. Un legacy sin snapshot en otra moneda no demuestra su
    // equivalente, así que no hace que el pedido parezca cobrado: el cobro nuevo entra igual.
    const { deps } = setup({
      order: order({ total: 365 }),
      stored: [{ id: "pay_legacy", amount: 365, currency: "USD" }],
    });

    await expect(
      registerOrderPayment(payload({ amount: 1, idempotencyKey: "key_after_legacy" }), deps),
    ).resolves.toMatchObject({ data: { amount: 1 } });
  });
});

describe("registerOrderPayment — A-71: idempotencia del cobro", () => {
  it("el mismo request repetido devuelve el MISMO cobro y no registra la plata dos veces", async () => {
    const { deps, paymentRepository } = setup();

    const first = await registerOrderPayment(payload({ amount: 100 }), deps);
    const second = await registerOrderPayment(payload({ amount: 100 }), deps);

    expect(second.data.id).toBe(first.data.id);
    expect(paymentRepository.payments).toHaveLength(1);
  });

  it("dos cobros parciales LEGÍTIMOS con claves distintas sí conviven", async () => {
    // El alcance de la clave es el cobro, no el pedido: dos abonos parciales son dos hechos distintos.
    const { deps, paymentRepository } = setup();

    await registerOrderPayment(payload({ amount: 100, idempotencyKey: "key_a" }), deps);
    await registerOrderPayment(payload({ amount: 180, idempotencyKey: "key_b" }), deps);

    expect(paymentRepository.payments).toHaveLength(2);
  });
});

describe("registerOrderPayment — D-020: el cobro nuevo no se firma sin snapshot", () => {
  it("guarda monto original, moneda, moneda base, tasa y equivalente de una sola vez", async () => {
    const { deps } = setup({ order: order({ total: 365 }) });

    const result = await registerOrderPayment(
      payload({ amount: 10, currency: "USD", idempotencyKey: "key_snapshot" }),
      deps,
    );

    expect(result.data).toMatchObject({
      amount: 10,
      currency: "USD",
      baseCurrencyCode: "NIO",
      exchangeRate: 36.5,
      baseAmount: 365,
      methodKind: "cash",
      idempotencyKey: "key_snapshot",
    });
  });
});

/** El repositorio en memoria del arnés, tipado como el puerto para poder consultar los cobros del turno. */
function paymentRepositoryOf(deps: unknown): InMemoryPaymentRepository {
  return (deps as { paymentRepository: InMemoryPaymentRepository }).paymentRepository;
}
