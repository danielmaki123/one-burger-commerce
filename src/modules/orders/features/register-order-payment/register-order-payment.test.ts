import { describe, expect, it, vi } from "vitest";

import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import type { OrderRecord } from "@/modules/orders/domain/order.types";

import {
  registerOrderPayment,
  settlementPaymentKey,
  type OrderPaymentScope,
  type RegisterOrderPaymentInput,
} from "./register-order-payment";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §26–§31, §34, §35) — **cobrar un pedido que ya existe**.
 *
 * El caso de uso nació en el hallazgo N3 con el shape mínimo que necesitaba la factura —un `Payment` por
 * request— y sigue siendo la **única** puerta del cobro de deuda. Lo que cambió es el contrato: ahora una
 * llamada es la **liquidación comercial completa** del saldo (brief §27), no un abono.
 *
 * Los tres cambios de contrato, cada uno con su motivo:
 *
 * 1. **El payload es una lista de medios**, para que el cobro partido sea una sola operación.
 * 2. **La igualdad es exacta**: `Σ equivalente == saldo`. El abono parcial desaparece (brief §31) y el
 *    sobrecobro se rechaza antes de escribir (brief §34, caso auditado 80 / 50 + 50).
 * 3. **Sin caja abierta no se cobra** (brief §36), la misma regla que protege la venta rápida.
 *
 * Los casos que se conservan de la versión anterior —`A-68` (el tope en moneda base), `A-71` (idempotencia),
 * `D-020` (el snapshot), el turno cerrado en el medio— siguen acá con el payload nuevo.
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

/** El payload: una liquidación con al menos un medio. La clave la manda el cliente. */
function payload(
  over: Partial<Omit<RegisterOrderPaymentInput, "payments">> & {
    payments?: RegisterOrderPaymentInput["payments"];
  } = {},
): RegisterOrderPaymentInput {
  return {
    orderId: "ord_01",
    idempotencyKey: "key_1",
    payments: [{ method: "cash", amount: 280, currency: "NIO" }],
    ...over,
  };
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
    stored?: Array<Record<string, unknown>>;
    /** `false` = el local no tiene caja abierta (el caso negativo de brief §36). */
    shiftOpen?: boolean;
  } = {},
) {
  const paymentRepository = new InMemoryPaymentRepository();
  const currentOrder = () => (input.order === undefined ? order() : input.order);

  const scope: OrderPaymentScope = {
    paymentRepository: {
      createPayment: (payment) => paymentRepository.createPayment(payment),
      listPaymentsByOrder: (orderId) => paymentRepository.listPaymentsByOrder(orderId),
    },
    /** `A-71` — el reintento con la misma clave devuelve los cobros que ya existen. */
    findSettlementPayments: async (key) =>
      paymentRepository.payments.filter((payment) =>
        (payment.idempotencyKey ?? "").startsWith(`${key}:`),
      ),
    /** `A-75` — el lock devuelve **el pedido bloqueado**: el caso de uso usa **ese** total para el saldo. */
    lockOrder: vi.fn(async (orderId: string) => {
      const locked = currentOrder();
      return locked ? { id: orderId, total: locked.total } : null;
    }),
    lockShift: vi.fn(async (shiftId: string) => ({ id: shiftId, status: "open" })),
  };

  const orderRepository = { findOrderById: vi.fn(async () => currentOrder()) };
  const shiftOpen = input.shiftOpen !== false;
  const findOpenShift = vi.fn(async () => (shiftOpen ? { id: "shift_01" } : null));

  for (const stored of input.stored ?? []) {
    paymentRepository.payments.push(storedPayment(stored));
  }

  const deps = {
    orderRepository,
    paymentRepository: {
      createPayment: (payment: Parameters<InMemoryPaymentRepository["createPayment"]>[0]) =>
        paymentRepository.createPayment(payment),
    },
    findOpenShift,
    runInOrderPaymentTransaction: <T,>(work: (scope: OrderPaymentScope) => Promise<T>) =>
      Promise.resolve(work(scope)),
    baseCurrencyCode: "NIO",
    rates: { USD: 36.5 } as Record<string, number | null | undefined>,
    paymentMethodKind: "cash" as const,
  } as never as Parameters<typeof registerOrderPayment>[1];

  return { paymentRepository, orderRepository, findOpenShift, scope, deps };
}

describe("registerOrderPayment · liquidación exacta", () => {
  it("un medio que cubre todo el saldo registra un cobro y lo atribuye al turno abierto", async () => {
    const { deps, paymentRepository } = setup();

    const result = await registerOrderPayment(payload({ terminalId: "term_1" }), deps);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ amount: 280, currency: "NIO", baseAmount: 280 });
    expect(result.appliedAmount).toBe(280);
    expect(paymentRepository.payments).toHaveLength(1);
  });

  it("dos medios que suman el saldo registran dos cobros, en el orden del payload", async () => {
    const { deps, paymentRepository } = setup();

    const result = await registerOrderPayment(
      payload({
        payments: [
          { method: "cash", amount: 100, currency: "NIO" },
          { method: "card", amount: 180, currency: "NIO" },
        ],
      }),
      deps,
    );

    expect(result.data.map((payment) => payment.amount)).toEqual([100, 180]);
    expect(result.data.map((payment) => payment.method)).toEqual(["cash", "card"]);
    expect(result.appliedAmount).toBe(280);
    // Cada fila lleva su propia clave derivada: es lo que permite que convivan bajo el índice único.
    expect(result.data.map((payment) => payment.idempotencyKey)).toEqual([
      settlementPaymentKey("key_1", 0),
      settlementPaymentKey("key_1", 1),
    ]);
    expect(paymentRepository.payments).toHaveLength(2);
  });

  it("un underpayment se rechaza y no registra nada", async () => {
    const { deps, paymentRepository } = setup();

    await expect(
      registerOrderPayment(payload({ payments: [{ method: "cash", amount: 100, currency: "NIO" }] }), deps),
    ).rejects.toMatchObject({
      status: 409,
      fields: { amount: expect.stringContaining("Faltan") },
    });

    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("un overpayment partido se rechaza y no registra nada (el caso auditado 80 / 50 + 50)", async () => {
    // Brief §34: hoy el cobro partido acepta C$50 + C$50 sobre una venta de C$80 y no explica los C$20.
    const { deps, paymentRepository } = setup({ order: order({ total: 80 }) });

    await expect(
      registerOrderPayment(
        payload({
          payments: [
            { method: "cash", amount: 50, currency: "NIO" },
            { method: "card", amount: 50, currency: "NIO" },
          ],
        }),
        deps,
      ),
    ).rejects.toMatchObject({
      status: 409,
      fields: { amount: expect.stringContaining("pasa el saldo") },
    });

    // Cero cambios financieros: el rechazo ocurre antes de escribir.
    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("un pedido ya cobrado no se vuelve a cobrar", async () => {
    const { deps } = setup({
      stored: [
        {
          id: "pay_previo",
          amount: 280,
          currency: "NIO",
          baseCurrencyCode: "NIO",
          exchangeRate: 1,
          baseAmount: 280,
        },
      ],
    });

    await expect(registerOrderPayment(payload({ idempotencyKey: "key_otra" }), deps)).rejects.toMatchObject({
      status: 409,
      fields: { order: expect.stringContaining("ya está cobrado") },
    });
  });

  it("un pedido con plata sin equivalente demostrable sale del flujo normal de cobro", async () => {
    // Brief §32/§33: un `Payment` legacy sin snapshot deja `unresolvedAmount > 0`; no se convierte con la
    // tasa vigente ni se trata como cobrable.
    const { deps, paymentRepository } = setup({
      stored: [{ id: "pay_legacy", amount: 100, currency: "USD" }],
    });

    await expect(registerOrderPayment(payload(), deps)).rejects.toMatchObject({
      status: 409,
      fields: { order: expect.stringContaining("sin equivalente demostrable") },
    });

    expect(paymentRepository.payments).toHaveLength(1);
  });
});

describe("registerOrderPayment · guardas del pedido y del turno", () => {
  it("un pedido que no existe devuelve 404", async () => {
    const { deps } = setup({ order: null });

    await expect(registerOrderPayment(payload(), deps)).rejects.toMatchObject({ status: 404 });
  });

  it("un pedido cancelado no se cobra", async () => {
    const { deps } = setup({ order: order({ status: "cancelled" }) });

    await expect(registerOrderPayment(payload(), deps)).rejects.toMatchObject({
      status: 409,
      fields: { order: expect.stringContaining("cancelado") },
    });
  });

  it("sin caja abierta no se cobra (brief §36)", async () => {
    const { deps, paymentRepository } = setup({ shiftOpen: false });

    await expect(registerOrderPayment(payload(), deps)).rejects.toMatchObject({
      status: 409,
      fields: { shift: expect.stringContaining("caja abierta") },
    });

    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("si el turno se cerró mientras se cobraba, rechaza el cobro sin registrarlo", async () => {
    const { deps, scope, paymentRepository } = setup();
    scope.lockShift = vi.fn(async (shiftId: string) => ({ id: shiftId, status: "closed" }));

    await expect(
      registerOrderPayment(payload(), {
        ...(deps as object),
        runInOrderPaymentTransaction: <T,>(work: (scope: OrderPaymentScope) => Promise<T>) =>
          Promise.resolve(work(scope)),
      } as never),
    ).rejects.toMatchObject({ status: 409 });

    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("una liquidación sin medios se rechaza como payload inválido", async () => {
    const { deps } = setup();

    await expect(registerOrderPayment(payload({ payments: [] }), deps)).rejects.toMatchObject({
      status: 422,
      fields: { payments: expect.any(String) },
    });
  });

  it("un cobro sin clave de idempotencia se rechaza con el campo señalado", async () => {
    const { deps } = setup();

    await expect(
      registerOrderPayment(payload({ idempotencyKey: "" }), deps),
    ).rejects.toMatchObject({
      status: 422,
      fields: { idempotencyKey: expect.any(String) },
    });
  });

  it("un monto que no es un número positivo se rechaza con el campo señalado", async () => {
    const { deps } = setup();

    await expect(
      registerOrderPayment(payload({ payments: [{ method: "cash", amount: 0, currency: "NIO" }] }), deps),
    ).rejects.toMatchObject({
      status: 422,
      fields: { amount: expect.any(String) },
    });
  });
});

describe("registerOrderPayment · A-68: el saldo se mide en moneda base", () => {
  it("un cobro en dólares liquida su equivalente en córdobas", async () => {
    const { deps } = setup({ order: order({ total: 365 }) });

    const result = await registerOrderPayment(
      payload({
        idempotencyKey: "key_usd",
        payments: [{ method: "cash", amount: 10, currency: "USD" }],
      }),
      deps,
    );

    // US$10 × 36.5 = C$365: liquida exacto.
    expect(result.data[0]).toMatchObject({
      amount: 10,
      currency: "USD",
      baseCurrencyCode: "NIO",
      exchangeRate: 36.5,
      baseAmount: 365,
    });
  });

  it("rechaza un cobro en otra moneda por su EQUIVALENTE: US$10 sobre C$280 pasa el saldo", async () => {
    // El monto **nominal** (10) está muy por debajo de 280, pero su equivalente (C$365) lo pasa: la
    // comparación es en moneda base y no en la suma cruda (`A-68`). Sin esto, el cobro se aceptaría y el
    // pedido quedaría sobrecobrado por el equivalente.
    const { deps, paymentRepository } = setup({ order: order({ total: 280 }) });

    await expect(
      registerOrderPayment(
        payload({ payments: [{ method: "cash", amount: 10, currency: "USD" }] }),
        deps,
      ),
    ).rejects.toMatchObject({
      status: 409,
      fields: { amount: expect.stringContaining("pasa el saldo") },
    });

    expect(paymentRepository.payments).toHaveLength(0);
  });

  it("sin tasa para la moneda del cobro rechaza en vez de comparar montos crudos", async () => {
    const { deps } = setup({ order: order({ total: 280 }) });

    await expect(
      registerOrderPayment(
        payload({ payments: [{ method: "cash", amount: 10, currency: "EUR" }] }),
        deps,
      ),
    ).rejects.toMatchObject({ status: 409, fields: { currency: expect.any(String) } });
  });

  it("un cobro partido en dos monedas se convierte con la tasa y liquida el saldo", async () => {
    const { deps } = setup({ order: order({ total: 465 }) });

    const result = await registerOrderPayment(
      payload({
        payments: [
          { method: "cash", amount: 10, currency: "USD" }, // C$365
          { method: "card", amount: 100, currency: "NIO" }, // C$100
        ],
      }),
      deps,
    );

    expect(result.appliedAmount).toBe(465);
  });
});

describe("registerOrderPayment · A-71: idempotencia de la liquidación", () => {
  it("el mismo request repetido devuelve los MISMOS cobros y no registra la plata dos veces", async () => {
    const { deps, paymentRepository } = setup();

    const request = payload({
      payments: [
        { method: "cash", amount: 100, currency: "NIO" },
        { method: "card", amount: 180, currency: "NIO" },
      ],
    });

    const first = await registerOrderPayment(request, deps);
    const second = await registerOrderPayment(request, deps);

    expect(second.data.map((payment) => payment.id)).toEqual(first.data.map((payment) => payment.id));
    expect(paymentRepository.payments).toHaveLength(2);
  });

  it("dos liquidaciones con claves distintas no conviven: la segunda no tiene saldo", async () => {
    // Con la igualdad exacta, dos liquidaciones del mismo pedido no pueden ser las dos legítimas: la
    // segunda encuentra el saldo en cero. Es la consecuencia buscada de «no existe el abono comercial».
    const { deps } = setup();

    await registerOrderPayment(payload({ idempotencyKey: "key_a" }), deps);

    await expect(registerOrderPayment(payload({ idempotencyKey: "key_b" }), deps)).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("registerOrderPayment · D-020: el cobro no se firma sin snapshot", () => {
  it("cada fila de la liquidación guarda sus cinco campos", async () => {
    const { deps } = setup({ order: order({ total: 365 }) });

    const { data } = await registerOrderPayment(
      payload({ payments: [{ method: "cash", amount: 10, currency: "USD" }] }),
      deps,
    );

    expect(data[0]).toMatchObject({
      amount: 10,
      currency: "USD",
      baseCurrencyCode: "NIO",
      exchangeRate: 36.5,
      baseAmount: 365,
      methodKind: "cash",
    });
  });

  it("el medio configurado que vino resuelto manda: el `kind`, el id y la entidad salen de él", async () => {
    const { deps } = setup();

    const { data } = await registerOrderPayment(
      payload({
        payments: [
          {
            method: "transfer",
            amount: 280,
            currency: "NIO",
            configuredMethod: { id: "pm_banpro", entityId: "bank_banpro", methodKind: "bank_transfer" },
          },
        ],
      }),
      deps,
    );

    expect(data[0]).toMatchObject({
      method: "transfer",
      methodKind: "bank_transfer",
      paymentMethodId: "pm_banpro",
      entityId: "bank_banpro",
    });
  });
});
