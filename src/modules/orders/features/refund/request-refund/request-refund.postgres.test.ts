import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { requestRefund } from "@/modules/orders/features/refund/request-refund/request-refund";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-73`, P1) — **pedir una devolución tiene que tener un límite
 * atómico**.
 *
 * `requestRefund` leía el cupo del cobro (`listByPayment`), comparaba y **después** insertaba, sin
 * transacción y con adaptadores de cliente raíz. Dos requests simultáneos del mismo cobro leen el mismo
 * cupo, los dos pasan la comprobación y los dos insertan: la suma de devoluciones queda **por encima** de
 * lo cobrado. Un `if` sobre una lectura no es protección —es una carrera con apariencia de control— y el
 * arreglo no es un chequeo más: es un **lock de la fila del cobro** (`SELECT … FOR UPDATE`) que serialice
 * la lectura del cupo con la escritura.
 *
 * La invariante: **la suma de las devoluciones no rechazadas de un cobro nunca supera el monto del cobro.**
 *
 * Es de la familia de `A-71`: la propiedad la garantiza la base, no la UI ni un `if`, y por eso se prueba
 * contra PostgreSQL real (`money-change` § *Pruebas: qué NO alcanza con un doble*).
 */

const PAYMENT_ID = "pay_a73";
const ORDER_ID = "ord_a73";

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_a73",
      name: "Manager de prueba",
      email: "manager@a73.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "manager",
    },
  });

  await prisma.location.create({
    data: { id: "loc_a73", name: "Local de prueba", slug: "local-a73", businessHours: [] },
  });

  await prisma.order.create({
    data: {
      id: ORDER_ID,
      orderNumber: "P-A73-1",
      type: "pickup",
      status: "ready",
      customerName: "Cliente de prueba",
      customerWhatsapp: "+50588887773",
      locationId: "loc_a73",
      subtotal: 100,
      total: 100,
    },
  });

  // El cobro del que se devuelve: C$100, con el snapshot de un cobro nuevo.
  await prisma.payment.create({
    data: {
      id: PAYMENT_ID,
      orderId: ORDER_ID,
      method: "cash",
      amount: 100,
      currency: "NIO",
      baseCurrencyCode: "NIO",
      exchangeRate: 1,
      baseAmount: 100,
      methodKind: "cash",
    },
  });
}

/**
 * El caso de uso tal como lo arma su composición. Se importa la composición real para no probar una copia:
 * un test que se arma su propio runner no prueba el que corre en producción.
 */
async function deps() {
  const { runInRefundRequestTransaction, refundRequestDependenciesForRoute } = await import(
    "@/app/api/admin/cash/shifts/refund-request-composition"
  );

  return refundRequestDependenciesForRoute({
    runInRefundRequestTransaction,
  });
}

/** El tipo del alcance transaccional, para la barrera. */
type RefundDeps = Awaited<ReturnType<typeof deps>>;
type RefundScope = Parameters<Parameters<RefundDeps["runInRefundRequestTransaction"]>[0]>[0];

/**
 * Fuerza el **cruce real**: las dos lecturas del cupo terminan antes de que ninguna escriba.
 *
 * Una barrera sólo en la lectura **no alcanza**, y está verificado: sin el lock, el segundo request leía
 * después de que el primero commiteara (1 devolución), veía el cupo consumido y se rechazaba solo —el test
 * pasaba **sin** el arreglo, o sea que no probaba nada—. Por eso hay **dos** compuertas:
 *
 * 1. las dos lecturas del cupo se esperan entre sí, y
 * 2. ningún `createRefund` sale hasta que las dos lecturas terminaron.
 *
 * Así el escenario es exactamente el que el arreglo previene: los dos requests ven el mismo cupo (0
 * devoluciones) y quieren escribir. Sin el `SELECT … FOR UPDATE` los dos insertan. Si la barrera no se
 * ejerce —porque el lock serializó de verdad— cada espera sigue a los 1,5 s para no colgarse.
 */
function withQuotaBarrier(dependencies: RefundDeps): RefundDeps {
  let lecturas = 0;
  let liberarLecturas = (): void => {};
  const todasLeidas = new Promise<void>((resolve) => {
    liberarLecturas = resolve;
  });

  const esperarLecturas = () =>
    Promise.race([todasLeidas, new Promise((resolve) => setTimeout(resolve, 1_500))]);

  return {
    ...dependencies,
    runInRefundRequestTransaction: <T,>(work: (scope: RefundScope) => Promise<T>) =>
      dependencies.runInRefundRequestTransaction(async (scope) => {
        const listRefundsByPayment = scope.listRefundsByPayment;
        const createRefund = scope.createRefund;

        return work({
          ...scope,
          listRefundsByPayment: async (paymentId: string) => {
            const refunds = await listRefundsByPayment(paymentId);

            lecturas += 1;
            if (lecturas === 2) liberarLecturas();

            await esperarLecturas();

            return refunds;
          },
          createRefund: async (input) => {
            await esperarLecturas();

            return createRefund(input);
          },
        });
      }),
  };
}

describe("A-73 · dos devoluciones simultáneas del mismo cupo (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("dos pedidos simultáneos del mismo cupo: la suma devuelta nunca supera lo cobrado", async () => {
    const prisma = getPrismaClient();

    const pedido = {
      paymentId: PAYMENT_ID,
      kind: "partial" as const,
      amount: 60,
      reason: "Faltaba una bebida",
      requestedByUserId: "user_a73",
      locationId: "loc_a73",
    };

    const results = await Promise.allSettled([
      requestRefund({ ...pedido, idempotencyKey: "key_refund_a" }, withQuotaBarrier(await deps())),
      requestRefund({ ...pedido, idempotencyKey: "key_refund_b" }, withQuotaBarrier(await deps())),
    ]);

    const refunds = await prisma.refund.findMany({ where: { paymentId: PAYMENT_ID } });
    const devuelto = refunds
      .filter((refund) => refund.status !== "rejected")
      .reduce((sum, refund) => sum + Number(refund.amount), 0);

    expect(devuelto, "se devolvió más de lo que se cobró").toBeLessThanOrEqual(100);

    // El que pierde no se cae por un error técnico: lo rechaza una regla de negocio (el cupo).
    const rechazado = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;

    expect(rechazado?.reason).toMatchObject({ status: 422 });
  });

  it("la misma request repetida con la misma clave NO consume el cupo dos veces", async () => {
    const prisma = getPrismaClient();

    const pedido = {
      paymentId: PAYMENT_ID,
      kind: "partial" as const,
      amount: 40,
      reason: "Faltaba una bebida",
      requestedByUserId: "user_a73",
      locationId: "loc_a73",
      idempotencyKey: "key_refund_repetida",
    };

    const primera = await requestRefund(pedido, await deps());
    const segunda = await requestRefund(pedido, await deps());

    expect(segunda.data.id).toBe(primera.data.id);

    const refunds = await prisma.refund.findMany({ where: { paymentId: PAYMENT_ID } });

    expect(refunds).toHaveLength(1);
  });
});
