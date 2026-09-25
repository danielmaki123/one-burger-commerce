import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { runInOrderPaymentTransaction } from "@/app/api/admin/orders/[id]/payment/payment-composition";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import {
  registerOrderPayment,
  type RegisterOrderPaymentDependencies,
} from "@/modules/orders/features/register-order-payment/register-order-payment";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * TASK-AUD-055 — **dos cobros simultáneos del mismo pedido no pueden superar el saldo pendiente**.
 *
 * `registerOrderPayment` valida el tope leyendo la suma de los cobros (`getPaymentSummary`) y **después**
 * escribe. Dos requests simultáneos leen los dos el mismo saldo, los dos pasan la comprobación y los dos
 * insertan: el pedido termina cobrado de más. Y la comprobación previa es un `if` sobre una lectura, no una
 * garantía.
 *
 * La invariante: **la suma aceptada nunca supera el total del pedido**. Se fija con dos requests
 * simultáneos reales contra PostgreSQL.
 */

const ORDER_ID = "ord_a55";

async function seed(total = 100): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_a55",
      name: "Cajera de prueba",
      email: "cajera@a55.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "cashier",
    },
  });

  await prisma.location.create({
    data: { id: "loc_a55", name: "Local de prueba", slug: "local-a55", businessHours: [] },
  });

  await prisma.order.create({
    data: {
      id: ORDER_ID,
      orderNumber: "P-A55-1",
      type: "pickup",
      status: "ready",
      customerName: "Cliente de prueba",
      customerWhatsapp: "+50588887772",
      locationId: "loc_a55",
      subtotal: total,
      total,
    },
  });
}

/** Las dependencias reales del cobro de un pedido existente (sin caja abierta: el turno no es el tema acá). */
async function deps(): Promise<RegisterOrderPaymentDependencies> {
  return {
    orderRepository: new PrismaOrderRepository(),
    paymentRepository: new PrismaPaymentRepository(),
    findOpenShift: async () => null,
    runInOrderPaymentTransaction,
    businessCurrencyCode: "NIO",
    usdExchangeRate: null,
  };
}

/**
 * Fuerza el cruce: las dos lecturas del saldo pendiente terminan **antes** de que ninguna escriba. Sin esto el
 * caso depende del planificador (y pasaba sin arreglar nada). Si solo llega una lectura —que es lo que pasa
 * cuando el fix serializa con el lock—, sigue a los 1,5 s para no colgar el test.
 */
function withReadBarrier<T extends RegisterOrderPaymentDependencies>(dependencies: T): T {
  let llegaron = 0;
  let liberar = (): void => {};
  const segunda = new Promise<void>((resolve) => {
    liberar = resolve;
  });

  /** La lectura del saldo pendiente espera a la otra: sin esto el cruce depende del planificador. */
  function barrera<TRepo extends object>(repository: TRepo): TRepo {
    return new Proxy(repository, {
      get(target, property, receiver) {
        if (property !== "getPaymentSummary") return Reflect.get(target, property, receiver);

        return async (orderId: string) => {
          const summary = await (target as { getPaymentSummary: (id: string) => Promise<unknown> })
            .getPaymentSummary(orderId);

          llegaron += 1;
          if (llegaron === 2) liberar();

          await Promise.race([segunda, new Promise((resolve) => setTimeout(resolve, 1_500))]);

          return summary;
        };
      },
    }) as TRepo;
  }

  return {
    ...dependencies,
    paymentRepository: barrera(dependencies.paymentRepository),
    /* El fix mueve la validación adentro de la transacción: la barrera tiene que cubrir ese camino también. */
    runInOrderPaymentTransaction: (work) =>
      dependencies.runInOrderPaymentTransaction((scope) =>
        work({ ...scope, paymentRepository: barrera(scope.paymentRepository) }),
      ),
  } as T;
}

describe("TASK-AUD-055 · doble cobro concurrente del mismo pedido (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed(100);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("dos cobros simultáneos que en suma pasan el total: uno solo entra", async () => {
    const prisma = getPrismaClient();

    const cobro = { orderId: ORDER_ID, method: "cash" as const, amount: 100, currency: "NIO" };
    const results = await Promise.allSettled([
      registerOrderPayment(cobro, withReadBarrier(await deps())),
      registerOrderPayment(cobro, withReadBarrier(await deps())),
    ]);

    const aceptados = results.filter((result) => result.status === "fulfilled");

    expect(aceptados, "los dos cobros pasaron la comprobación previa").toHaveLength(1);

    const payments = await prisma.payment.findMany({ where: { orderId: ORDER_ID } });
    const cobrado = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    expect(cobrado, "el pedido quedó cobrado por encima de su total").toBeLessThanOrEqual(100);

    // Y el que pierde no se cae por un error técnico: lo rechaza una regla de negocio.
    const rechazado = results.find((result) => result.status === "rejected") as PromiseRejectedResult;

    expect((rechazado.reason as { status?: number }).status).toBe(409);
  });

  it("dos cobros simultáneos que en suma entran justo en el total: los dos entran", async () => {
    const prisma = getPrismaClient();

    const results = await Promise.allSettled([
      registerOrderPayment(
        { orderId: ORDER_ID, method: "cash", amount: 60, currency: "NIO" },
        withReadBarrier(await deps()),
      ),
      registerOrderPayment(
        { orderId: ORDER_ID, method: "card", amount: 40, currency: "NIO" },
        withReadBarrier(await deps()),
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);

    const payments = await prisma.payment.findMany({ where: { orderId: ORDER_ID } });

    expect(payments).toHaveLength(2);
  });
});
