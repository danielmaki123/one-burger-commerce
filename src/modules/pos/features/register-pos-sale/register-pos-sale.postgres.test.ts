import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { registerOutboxEventBusHandlers } from "@/modules/notifications/adapters/outbox-subscriber";
import { createProductionPosSaleDependencies } from "@/modules/pos/adapters/production-pos-sale";
import {
  registerPosSale,
  type RegisterPosSaleDependencies,
} from "@/modules/pos/features/register-pos-sale/register-pos-sale";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * TASK-AUD-004 — ¿qué queda en la base cuando una venta de mostrador se corta en el medio?
 *
 * `registerPosSale` hace dos cosas en orden: crea el pedido (con el cupón y el descuento, si hay) y
 * **después** registra los cobros, **uno por uno**, cada uno con su propio `create`. Si el segundo cobro
 * falla, el primero ya está guardado y el pedido también.
 *
 * Estos tests corren contra **PostgreSQL real** y con las dependencias de producción: lo que se mide es
 * qué quedó **persistido**, y un repositorio en memoria no puede fallar a mitad de camino como falla la
 * base, así que no puede demostrar nada de esto.
 *
 * **Cómo se inyecta la falla (y por qué así).** Se envuelve el repositorio de cobros **del alcance
 * transaccional** con un `Proxy` que delega **todo** al adaptador real y hace fallar el N-ésimo
 * `createPayment`. Lo que se está probando no es *por qué* falla la escritura —eso puede ser mil cosas: la
 * conexión, un `timeout`, un deploy en el medio— sino **qué estado deja** una venta que se cortó entre dos
 * cobros. El pedido y el primer cobro se escriben de verdad contra PostgreSQL, y la falla ocurre adentro de
 * la transacción, que es donde puede ocurrir en producción.
 *
 * (El primer intento de esta reproducción inyectaba la falla con un monto que no entra en
 * `numeric(10,2)`: no servía, porque la validación de dominio lo rechaza **antes** de escribir nada y el
 * test pasaba sin medir. Queda dicho acá.)
 */

const IDEMPOTENCY_KEY = "sale-atomicity-1";
const BUSINESS_CURRENCY = "NIO";

/** El repositorio real, pero el N-ésimo `createPayment` falla. Todo lo demás sigue siendo PostgreSQL. */
function failOnNthPayment(real: PaymentRepository, n: number): PaymentRepository {
  let seen = 0;

  return new Proxy(real, {
    get(target, property, receiver) {
      if (property === "createPayment") {
        return async (input: Parameters<PaymentRepository["createPayment"]>[0]) => {
          seen += 1;

          if (seen === n) {
            throw new Error("falla inyectada entre el cobro 1 y el 2");
          }

          return target.createPayment(input);
        };
      }

      return Reflect.get(target, property, receiver);
    },
  });
}

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_cashier_test",
      name: "Cajera de prueba",
      email: "cajera@test.local",
      passwordHash: "no-es-un-hash-real",
      role: "cashier",
    },
  });

  await prisma.location.create({
    data: {
      id: "loc_test",
      name: "Local de prueba",
      slug: "local-de-prueba",
      businessHours: [],
    },
  });

  await prisma.category.create({
    data: { id: "cat_test", name: "Categoría de prueba", slug: "categoria-de-prueba" },
  });

  await prisma.product.create({
    data: {
      id: "prod_test",
      categoryId: "cat_test",
      name: "Producto de prueba",
      basePrice: 100,
    },
  });

  await prisma.shift.create({
    data: {
      id: "shift_test",
      locationId: "loc_test",
      userId: "user_cashier_test",
      status: "open",
      openingAmount: 0,
    },
  });
}

function saleInput(payments: Array<{ method: "cash" | "card"; amount: number }>) {
  return {
    draft: {
      locationId: "loc_test",
      lines: [{ productId: "prod_test", name: "Producto de prueba", unitPrice: 100, quantity: 1 }],
    },
    customer: { name: "Cliente de prueba", whatsapp: "+50588887777" },
    payments: payments.map((payment) => ({ ...payment, currency: BUSINESS_CURRENCY })),
    idempotencyKey: IDEMPOTENCY_KEY,
  };
}

/** Las dependencias de producción, con el cobro N fallando **adentro** de la transacción. */
async function dependenciesFailingOnPayment(n: number): Promise<RegisterPosSaleDependencies> {
  const production = await createProductionPosSaleDependencies();

  return {
    ...production,
    runInSaleTransaction: (work) =>
      production.runInSaleTransaction((scope) =>
        work({ ...scope, paymentRepository: failOnNthPayment(scope.paymentRepository, n) }),
      ),
  };
}

describe("TASK-AUD-004 · atomicidad de la venta del mostrador (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("el segundo cobro que falla no deja el pedido persistido a medias", async () => {
    const prisma = getPrismaClient();

    const failing = saleInput([
      { method: "cash", amount: 60 },
      { method: "card", amount: 40 },
    ]);

    await expect(
      registerPosSale(failing, await dependenciesFailingOnPayment(2)),
    ).rejects.toThrow("falla inyectada");

    // La invariante: una venta es todo o nada. Si un cobro no se pudo registrar, el pedido tampoco puede
    // quedar: un pedido con la mitad de sus cobros es una venta que el arqueo no puede explicar.
    expect(
      await prisma.order.count({ where: { idempotencyKey: IDEMPOTENCY_KEY } }),
      "el pedido quedó persistido con un solo cobro: venta parcial",
    ).toBe(0);

    expect(await prisma.payment.count(), "quedó un cobro huérfano de una venta que no existe").toBe(0);
  });

  it("un reintento con la misma clave completa la venta en vez de devolverla incompleta", async () => {
    const prisma = getPrismaClient();

    const failing = saleInput([
      { method: "cash", amount: 60 },
      { method: "card", amount: 40 },
    ]);

    await expect(
      registerPosSale(failing, await dependenciesFailingOnPayment(2)),
    ).rejects.toThrow("falla inyectada");

    // El cajero reintenta con la MISMA clave de intento: es el caso real de «no salió, probá de nuevo».
    const retry = await registerPosSale(
      saleInput([
        { method: "cash", amount: 60 },
        { method: "card", amount: 40 },
      ]),
      await createProductionPosSaleDependencies(),
    );

    expect(retry.payments).toHaveLength(2);
    expect(await prisma.payment.count({ where: { orderId: retry.order.id } })).toBe(2);
    expect(await prisma.order.count({ where: { idempotencyKey: IDEMPOTENCY_KEY } })).toBe(1);
  });

  it("dos cobros simultáneos con la misma clave no dejan una venta a medio cobrar", async () => {
    const prisma = getPrismaClient();

    // El caso real: el cajero toca «cobrar» dos veces (o la red reintenta) y las dos requests entran
    // juntas. La clave de intento hace que exista **un** pedido; lo que no puede pasar es que la segunda
    // —la que encuentra el pedido ya creado— conteste una venta con la mitad de los cobros.
    const [primera, segunda] = await Promise.all([
      registerPosSale(
        saleInput([
          { method: "cash", amount: 60 },
          { method: "card", amount: 40 },
        ]),
        await createProductionPosSaleDependencies(),
      ),
      registerPosSale(
        saleInput([
          { method: "cash", amount: 60 },
          { method: "card", amount: 40 },
        ]),
        await createProductionPosSaleDependencies(),
      ),
    ]);

    expect(await prisma.order.count({ where: { idempotencyKey: IDEMPOTENCY_KEY } })).toBe(1);
    expect(await prisma.payment.count()).toBe(2);

    // Las dos respuestas describen la misma venta completa: 100 cobrados entre los dos medios.
    for (const respuesta of [primera, segunda]) {
      expect(respuesta.payments).toHaveLength(2);
      expect(respuesta.paidInBusinessCurrency).toBe(100);
    }
  });

  it("si el total real del menú ya no cubre el cobro, no queda el pedido sin cobros", async () => {
    const prisma = getPrismaClient();

    // El cajero cargó el catálogo con un precio viejo (50) y cobró eso; en la base el producto vale 100.
    // El alta recalcula con el precio real y el cobro no alcanza: `registerPosSale` corta con 409 y **no
    // puede quedar el pedido**, porque sería una venta que nadie cobró y que el arqueo no explica.
    //
    // Se cobra con **tarjeta** a propósito: es el único camino que llega a esa comprobación. Con efectivo
    // viaja `paidWithAmount` y el alta lo valida contra el total real, así que rechaza antes (400) sin
    // escribir nada; con tarjeta no hay «con cuánto paga» y el desajuste se ve recién con el total del
    // pedido ya cotizado.
    const stale = {
      ...saleInput([{ method: "card", amount: 50 }]),
      draft: {
        locationId: "loc_test",
        lines: [{ productId: "prod_test", name: "Producto de prueba", unitPrice: 50, quantity: 1 }],
      },
    };

    await expect(
      registerPosSale(stale, await createProductionPosSaleDependencies()),
    ).rejects.toThrow(/no alcanza/);

    expect(
      await prisma.order.count({ where: { idempotencyKey: IDEMPOTENCY_KEY } }),
      "el alta rechazó el cobro pero dejó el pedido guardado",
    ).toBe(0);
    expect(await prisma.payment.count()).toBe(0);
  });

  it("el aviso de pedido creado sale después del commit: una venta que se deshace no lo deja", async () => {
    // El bus de eventos escribe el aviso en el `outbox` con el cliente **raíz** de la base: si se publicara
    // adentro de la transacción, un rollback dejaría el aviso vivo y cocina recibiría un pedido que no
    // existe. Por eso el adaptador lo difiere hasta después del commit (TASK-AUD-004).
    registerOutboxEventBusHandlers();

    const prisma = getPrismaClient();

    await expect(
      registerPosSale(
        saleInput([
          { method: "cash", amount: 60 },
          { method: "card", amount: 40 },
        ]),
        await dependenciesFailingOnPayment(2),
      ),
    ).rejects.toThrow("falla inyectada");

    expect(
      await prisma.outboxEvent.count({ where: { eventType: "OrderCreated" } }),
      "la venta se deshizo pero quedó el aviso del pedido",
    ).toBe(0);

    // La venta que sí completa deja su aviso, una sola vez.
    await registerPosSale(
      saleInput([
        { method: "cash", amount: 60 },
        { method: "card", amount: 40 },
      ]),
      await createProductionPosSaleDependencies(),
    );

    expect(await prisma.outboxEvent.count({ where: { eventType: "OrderCreated" } })).toBe(1);
  });

  it("una venta que se deshace no deja el cupón consumido", async () => {
    const prisma = getPrismaClient();

    // El roadmap lo pedía explícito: el riesgo no es solo el pedido a medias, es también **el uso del
    // cupón**. El alta consume el uso con un `increment` (`consumeCouponUsage`) y antes de la transacción
    // ese aumento quedaba hecho para una venta que nunca terminó de cobrarse: el cliente perdía el cupón y
    // nadie cobró.
    await prisma.coupon.create({
      data: { code: "PROMO10", type: "percentage", value: 10, usageLimit: 1, usedCount: 0 },
    });

    const conCupon = {
      ...saleInput([
        { method: "cash", amount: 50 },
        { method: "card", amount: 40 },
      ]),
      couponCode: "PROMO10",
    };

    await expect(
      registerPosSale(conCupon, await dependenciesFailingOnPayment(2)),
    ).rejects.toThrow("falla inyectada");

    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);

    const coupon = await prisma.coupon.findUnique({ where: { code: "PROMO10" } });

    expect(coupon?.usedCount, "el cupón quedó gastado por una venta que no existe").toBe(0);
  });

  it("una venta que sí completa deja el pedido con sus dos cobros y el turno firmado", async () => {
    const prisma = getPrismaClient();

    const sale = await registerPosSale(
      saleInput([
        { method: "cash", amount: 60 },
        { method: "card", amount: 40 },
      ]),
      await createProductionPosSaleDependencies(),
    );

    const payments = await prisma.payment.findMany({ where: { orderId: sale.order.id } });

    expect(payments).toHaveLength(2);
    expect(payments.every((payment) => payment.shiftId === "shift_test")).toBe(true);
  });
});
