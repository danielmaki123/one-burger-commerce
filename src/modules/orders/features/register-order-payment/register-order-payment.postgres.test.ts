import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { runInOrderPaymentTransaction } from "@/app/api/admin/orders/[id]/payment/payment-composition";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import {
  registerOrderPayment,
  settlementPaymentKey,
  type OrderPaymentScope,
  type RegisterOrderPaymentDependencies,
} from "@/modules/orders/features/register-order-payment/register-order-payment";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §49, §50, §51, §52) — **las propiedades que sólo PostgreSQL
 * puede demostrar**: atomicidad, concurrencia, idempotencia y turno, sobre la liquidación del POS.
 *
 * El brief es explícito en que un doble en memoria **no** sirve para esto (§49: «No dejar una prueba falsa
 * basada únicamente en dobles/mocks»). Cada caso de acá corre contra la base real y usa la **misma**
 * composición de producción (`runInOrderPaymentTransaction`), porque un test que se arma su propio runner no
 * prueba el que corre en producción.
 *
 * Las propiedades:
 *
 * 1. **Atomicidad** (§29): si el segundo `Payment` de una liquidación falla, quedan **cero** cobros. Ninguna
 *    liquidación puede dejar plata parcial por un fallo técnico intermedio.
 * 2. **Concurrencia** (§50): dos requests simultáneos cobrando el mismo saldo lo cobran **una sola vez**.
 * 3. **Idempotencia** (§51): dos requests con la misma clave producen **un solo** hecho financiero.
 * 4. **Turno** (§52): el `Payment` no queda sin turno ni asociado al turno equivocado.
 */

const ORDER_ID = "ord_pos06";

async function seed(total = 100): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_pos06",
      name: "Cajera de prueba",
      email: "cajera@pos06.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "cashier",
    },
  });

  await prisma.location.create({
    data: { id: "loc_pos06", name: "Local de prueba", slug: "local-pos06", businessHours: [] },
  });

  await prisma.order.create({
    data: {
      id: ORDER_ID,
      orderNumber: "P-POS06-1",
      type: "pickup",
      status: "ready_for_pickup",
      customerName: "Cliente de prueba",
      customerWhatsapp: "+50588887770",
      locationId: "loc_pos06",
      subtotal: total,
      total,
    },
  });
}

/** Las dependencias reales de la liquidación, con un turno abierto en el local. */
async function deps(
  overrides: Partial<RegisterOrderPaymentDependencies> = {},
): Promise<RegisterOrderPaymentDependencies> {
  return {
    orderRepository: new PrismaOrderRepository(),
    paymentRepository: new PrismaPaymentRepository(),
    findOpenShift: async () => ({ id: "shift_pos06" }),
    runInOrderPaymentTransaction,
    baseCurrencyCode: "NIO",
    rates: { USD: 36.5 },
    paymentMethodKind: "cash",
    ...overrides,
  };
}

/** Un turno abierto real, para el caso del turno (brief §52). */
async function seedShift(id = "shift_pos06", status: "open" | "closed" = "open") {
  const prisma = getPrismaClient();

  await prisma.shift.create({
    data: {
      id,
      locationId: "loc_pos06",
      userId: "user_pos06",
      status,
      openingAmount: 0,
    },
  });
}

/**
 * Fuerza el cruce: las dos lecturas del saldo terminan **antes** de que ninguna escriba. Sin esto el caso
 * depende del planificador y pasaría sin arreglar nada. Si sólo llega una lectura —que es lo que pasa cuando
 * el lock serializa—, sigue a los 1,5 s para no colgar el test.
 */
function withReadBarrier<T extends RegisterOrderPaymentDependencies>(dependencies: T): T {
  let llegaron = 0;
  let liberar = (): void => {};
  const segunda = new Promise<void>((resolve) => {
    liberar = resolve;
  });

  function barrera<TRepo extends object>(repository: TRepo): TRepo {
    return new Proxy(repository, {
      get(target, property, receiver) {
        if (property !== "listPaymentsByOrder") return Reflect.get(target, property, receiver);

        return async (orderId: string) => {
          const payments = await (target as { listPaymentsByOrder: (id: string) => Promise<unknown> })
            .listPaymentsByOrder(orderId);

          llegaron += 1;
          if (llegaron === 2) liberar();

          await Promise.race([segunda, new Promise((resolve) => setTimeout(resolve, 1_500))]);

          return payments;
        };
      },
    }) as TRepo;
  }

  return {
    ...dependencies,
    runInOrderPaymentTransaction: (work) =>
      dependencies.runInOrderPaymentTransaction((scope) =>
        work({ ...scope, paymentRepository: barrera(scope.paymentRepository) }),
      ),
  } as T;
}

async function paymentsOf(orderId = ORDER_ID) {
  return getPrismaClient().payment.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
}

describe("brief §49 · atomicidad de la liquidación partida (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed(800);
    await seedShift();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("si el segundo cobro falla, quedan CERO cobros: no hay plata parcial", async () => {
    /**
     * Se envuelve el `createPayment` del alcance para que el **segundo** falle. El fallo es de la escritura,
     * no de una validación previa: es exactamente el escenario «Payment 1 se insertaría, Payment 2 falla».
     */
    let created = 0;

    const failingTransaction = <T,>(work: (scope: OrderPaymentScope) => Promise<T>): Promise<T> =>
      runInOrderPaymentTransaction((scope) =>
        work({
          ...scope,
          /**
           * El doble del alcance reproduce **su** contrato: los métodos de `PrismaPaymentRepository` viven en
           * el prototipo, así que el spread los perdería y el caso fallaría por un `not a function` en vez de
           * por el fallo simulado —un rojo por la razón equivocada—.
           */
          paymentRepository: {
            createPayment: async (input) => {
              created += 1;
              if (created === 2) throw new Error("fallo técnico simulado en el segundo cobro");
              return scope.paymentRepository.createPayment(input);
            },
            listPaymentsByOrder: (orderId) => scope.paymentRepository.listPaymentsByOrder(orderId),
          },
        }),
      );

    await expect(
      registerOrderPayment(
        {
          orderId: ORDER_ID,
          idempotencyKey: "key_atomica",
          payments: [
            { method: "cash", amount: 300, currency: "NIO" },
            { method: "card", amount: 500, currency: "NIO" },
          ],
        },
        await deps({ runInOrderPaymentTransaction: failingTransaction }),
      ),
    ).rejects.toThrow("fallo técnico simulado");

    // La propiedad que importa: el primero entró y el ROLLBACK se lo llevó.
    expect(created, "los dos intentos de escritura tienen que haber corrido").toBe(2);
    expect(await paymentsOf(), "quedó un Payment parcial de una liquidación que no se completó").toHaveLength(0);
  });

  it("la liquidación completa entra entera: dos cobros en la misma transacción", async () => {
    const result = await registerOrderPayment(
      {
        orderId: ORDER_ID,
        idempotencyKey: "key_entera",
        payments: [
          { method: "cash", amount: 300, currency: "NIO" },
          { method: "card", amount: 500, currency: "NIO" },
        ],
      },
      await deps(),
    );

    expect(result.appliedAmount).toBe(800);

    const payments = await paymentsOf();
    expect(payments).toHaveLength(2);
    expect(payments.map((payment) => Number(payment.amount))).toEqual([300, 500]);
    expect(payments.reduce((sum, payment) => sum + Number(payment.baseAmount), 0)).toBe(800);
  });
});

describe("brief §50 · concurrencia: el saldo se cobra una sola vez (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed(800);
    await seedShift();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("dos liquidaciones simultáneas del mismo saldo: una sola entra y no hay sobrecobro", async () => {
    const request = (key: string) => ({
      orderId: ORDER_ID,
      idempotencyKey: key,
      payments: [{ method: "cash" as const, amount: 800, currency: "NIO" }],
    });

    const results = await Promise.allSettled([
      registerOrderPayment(request("key_carrera_a"), withReadBarrier(await deps())),
      registerOrderPayment(request("key_carrera_b"), withReadBarrier(await deps())),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
      "las dos liquidaciones cobraron el mismo saldo",
    ).toHaveLength(1);

    const payments = await paymentsOf();
    const cobrado = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    expect(payments, "el pedido quedó cobrado dos veces").toHaveLength(1);
    expect(cobrado, "el pedido quedó cobrado por encima de su total").toBeLessThanOrEqual(800);

    // El que pierde no se cae por un error técnico: lo rechaza una regla de negocio.
    const rechazado = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect((rechazado.reason as { status?: number }).status).toBe(409);
  });
});

describe("brief §51 · idempotencia de la liquidación (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed(800);
    await seedShift();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("dos requests simultáneos con la MISMA clave producen un solo hecho financiero", async () => {
    const request = {
      orderId: ORDER_ID,
      idempotencyKey: "key_simultanea",
      payments: [
        { method: "cash" as const, amount: 300, currency: "NIO" },
        { method: "card" as const, amount: 500, currency: "NIO" },
      ],
    };

    const results = await Promise.allSettled([
      registerOrderPayment(request, await deps()),
      registerOrderPayment(request, await deps()),
    ]);

    const payments = await paymentsOf();

    expect(payments, "el reintento simultáneo registró la misma plata dos veces").toHaveLength(2);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);

    // Las dos respuestas apuntan al MISMO hecho financiero.
    const ids = results.map((result) =>
      (result as PromiseFulfilledResult<{ data: Array<{ id: string }> }>).value.data
        .map((payment) => payment.id)
        .sort(),
    );
    expect(ids[0]).toEqual(ids[1]);
  });

  it("el reintento serial (no simultáneo) tampoco duplica la liquidación", async () => {
    const request = {
      orderId: ORDER_ID,
      idempotencyKey: "key_serial",
      payments: [{ method: "cash" as const, amount: 800, currency: "NIO" }],
    };

    const first = await registerOrderPayment(request, await deps());
    const second = await registerOrderPayment(request, await deps());

    expect(await paymentsOf()).toHaveLength(1);
    expect(second.data.map((payment) => payment.id)).toEqual(first.data.map((payment) => payment.id));
    // La clave derivada es la que garantiza la unicidad en la base.
    expect(first.data[0].idempotencyKey).toBe(settlementPaymentKey("key_serial", 0));
  });
});

describe("brief §52 · el turno del cobro (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed(100);
    await seedShift();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("el cobro queda asociado al turno abierto del local", async () => {
    await registerOrderPayment(
      {
        orderId: ORDER_ID,
        idempotencyKey: "key_turno",
        payments: [{ method: "cash", amount: 100, currency: "NIO" }],
      },
      await deps(),
    );

    const payments = await paymentsOf();

    expect(payments).toHaveLength(1);
    expect(payments[0].shiftId, "el Payment quedó sin turno").toBe("shift_pos06");
  });

  it("sin caja abierta no se cobra: no hay arqueo que lo explique", async () => {
    await expect(
      registerOrderPayment(
        {
          orderId: ORDER_ID,
          idempotencyKey: "key_sin_caja",
          payments: [{ method: "cash", amount: 100, currency: "NIO" }],
        },
        await deps({ findOpenShift: async () => null }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(await paymentsOf()).toHaveLength(0);
  });

  it("si la caja se cierra entre la lectura y la escritura, el cobro se rechaza y no queda asociado a un turno cerrado", async () => {
    const prisma = getPrismaClient();

    // El turno se cierra **después** de resolverlo pero **antes** de que la transacción lo bloquee: es la
    // ventana real que `lockShift` + la comprobación de estado tienen que cubrir.
    const closingTransaction = <T,>(work: (scope: OrderPaymentScope) => Promise<T>): Promise<T> =>
      runInOrderPaymentTransaction(async (scope) => {
        await prisma.shift.update({ where: { id: "shift_pos06" }, data: { status: "closed" } });

        return work(scope);
      });

    await expect(
      registerOrderPayment(
        {
          orderId: ORDER_ID,
          idempotencyKey: "key_turno_cerrado",
          payments: [{ method: "cash", amount: 100, currency: "NIO" }],
        },
        await deps({ runInOrderPaymentTransaction: closingTransaction }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(await paymentsOf()).toHaveLength(0);
  });
});

describe("brief §34 · el sobrecobro partido no deja rastro (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed(80);
    await seedShift();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("80 con 50 + 50 se rechaza y no hay cambios financieros", async () => {
    const spy = vi.fn();

    await expect(
      registerOrderPayment(
        {
          orderId: ORDER_ID,
          idempotencyKey: "key_over",
          payments: [
            { method: "cash", amount: 50, currency: "NIO" },
            { method: "card", amount: 50, currency: "NIO" },
          ],
        },
        await deps(),
      ).then((result) => {
        spy();
        return result;
      }),
    ).rejects.toMatchObject({ status: 409 });

    expect(spy, "la liquidación sobrecobrada se aceptó").not.toHaveBeenCalled();
    expect(await paymentsOf()).toHaveLength(0);
  });
});
