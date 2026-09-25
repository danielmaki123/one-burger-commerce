import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { closeShift } from "@/modules/orders/features/shift/close-shift";
import { createProductionPosSaleDependencies } from "@/modules/pos/adapters/production-pos-sale";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { registerPosSale } from "@/modules/pos/features/register-pos-sale/register-pos-sale";
import type { PosSaleTransactionScope } from "@/modules/pos/features/register-pos-sale/register-pos-sale";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * TASK-AUD-005 — el cierre del turno contra **PostgreSQL real**.
 *
 * Dos invariantes que un doble en memoria no puede demostrar (la skill de dinero §2: transacción, rollback,
 * lock y carrera se prueban contra la base):
 *
 * 1. **El cierre es todo o nada**: el snapshot del turno (con su diferencia firmada), los conteos de cierre
 *    y los cierres de banco se guardan juntos. Un turno **cerrado y firmado** sin el detalle que lo
 *    justifica no se puede volver a cerrar: el arqueo quedaría incompleto para siempre.
 * 2. **Un cobro y un cierre no se cruzan**: el cierre bloquea el turno antes de leer los cobros que firma, y
 *    el cobro lo bloquea antes de escribir. O la venta commiteó antes (y su plata entra al arqueo) o llega
 *    después (y se rechaza). Sin eso, la plata de esa ventana no entraba a ningún arqueo.
 */

const SHIFT_ID = "shift_test";
const IDEMPOTENCY_KEY = "shift-atomicity-1";

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_cashier_test",
      name: "Cajera de prueba",
      email: "cajera@shift.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "cashier",
    },
  });

  await prisma.location.create({
    data: {
      id: "loc_test",
      name: "Local de prueba",
      slug: "local-de-prueba-shift",
      businessHours: [],
    },
  });

  await prisma.category.create({
    data: { id: "cat_test", slug: "categoria-de-prueba-shift", name: "Categoría de prueba" },
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
      id: SHIFT_ID,
      locationId: "loc_test",
      userId: "user_cashier_test",
      status: "open",
      openingAmount: 0,
    },
  });
}

/** Una venta de mostrador de 100, en efectivo. */
async function sellOneHundred() {
  return registerPosSale(
    {
      draft: {
        locationId: "loc_test",
        lines: [{ productId: "prod_test", name: "Producto de prueba", unitPrice: 100, quantity: 1 }],
      },
      customer: { name: "Cliente de prueba", whatsapp: "+50588887777" },
      payments: [{ method: "cash", amount: 100, currency: "NIO" }],
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    await createProductionPosSaleDependencies(),
  );
}

async function closeDeps() {
  return createProductionPosShiftDependencies({ locationId: "loc_test" });
}

describe("TASK-AUD-005 · atomicidad del cierre de turno (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("si una escritura del cierre falla, el turno NO queda cerrado y firmado", async () => {
    const prisma = getPrismaClient();

    // La falla se provoca con el banco del cuadre: el repositorio escribe el snapshot del turno y después
    // los cierres de banco, y esa fila no existe (la clave foránea la rechaza). Es el escenario real de «se
    // cortó entre la primera escritura y las demás», sin mocks: la base hace lo que haría en producción.
    await expect(
      new PrismaShiftRepository().closeShift(SHIFT_ID, {
        closingAmount: 100,
        expectedAmount: 100,
        expectedByCurrency: { NIO: 100 },
        cashSalesAmount: 100,
        closingCounts: [{ currency: "NIO", denomination: 100, quantity: 1 }],
        bankCloses: [{ bankId: "bank_que_no_existe", declaredAmount: 50, currency: "NIO" }],
      }),
    ).rejects.toThrow();

    const shift = await prisma.shift.findUnique({ where: { id: SHIFT_ID } });

    expect(shift?.status, "el turno quedó cerrado sin su detalle: arqueo incompleto para siempre").toBe(
      "open",
    );
    expect(shift?.expectedAmount, "el snapshot del arqueo sobrevivió al rollback").toBeNull();
    expect(await prisma.shiftBankClose.count()).toBe(0);
    expect(await prisma.shiftCashCount.count({ where: { kind: "closing" } })).toBe(0);
  });

  it("dos cierres simultáneos del mismo turno: uno solo gana y el detalle queda una vez", async () => {
    const prisma = getPrismaClient();
    const deps = await closeDeps();

    const [primero, segundo] = await Promise.all([
      closeShift(
        {
          shiftId: SHIFT_ID,
          closingAmount: 100,
          closingCounts: [{ currency: "NIO", denomination: 100, quantity: 1 }],
        },
        deps,
      ),
      closeShift(
        {
          shiftId: SHIFT_ID,
          closingAmount: 999,
          closingCounts: [{ currency: "NIO", denomination: 100, quantity: 9 }],
        },
        deps,
      ),
    ]);

    const ganadores = [primero, segundo].filter((result) => result.data !== null);

    expect(ganadores, "los dos cierres se creyeron el primero").toHaveLength(1);
    expect(ganadores[0].data?.closingAmount).toBe(100);

    const shift = await prisma.shift.findUnique({ where: { id: SHIFT_ID } });

    expect(shift?.status).toBe("closed");
    expect(Number(shift?.closingAmount)).toBe(100);
    // El detalle del ganador, una sola vez (el perdedor no agregó su conteo).
    const counts = await prisma.shiftCashCount.findMany({ where: { kind: "closing" } });

    expect(counts).toHaveLength(1);
    expect(counts[0].quantity).toBe(1);
  });

  it("un cierre que arranca DESPUÉS del cobro cuenta esa plata en el arqueo", async () => {
    // La venta entra primero: su cobro queda firmado con el turno. El cierre, después, tiene que contarlo.
    const sale = await sellOneHundred();

    expect(sale.order.total).toBe(100);

    const cierre = await closeShift({ shiftId: SHIFT_ID, closingAmount: 100 }, await closeDeps());

    expect(cierre.data?.expectedAmount, "el arqueo no vio el cobro del turno").toBe(100);
    expect(cierre.data?.cashSalesAmount).toBe(100);
    expect(cierre.data?.difference).toBe(0);
  });

  it("una venta que entra cuando el turno ya se cerró se rechaza y no deja ni cobro ni pedido", async () => {
    const prisma = getPrismaClient();

    // La ventana real: el mostrador ya resolvió la caja abierta y la caja se cierra **antes** de que la
    // venta entre a su transacción. Se provoca cerrando el turno justo antes de abrir la transacción de la
    // venta (misma ventana, sin depender de un `sleep`): es el orden que dejaba el cobro huérfano.
    const production = await createProductionPosSaleDependencies();
    const shiftDeps = await closeDeps();

    const saleDeps = {
      ...production,
      runInSaleTransaction: <T,>(work: (scope: PosSaleTransactionScope) => Promise<T>) =>
        production.runInSaleTransaction(async (scope) => {
          await closeShift({ shiftId: SHIFT_ID, closingAmount: 0 }, shiftDeps);

          return work(scope);
        }),
    };

    await expect(
      registerPosSale(
        {
          draft: {
            locationId: "loc_test",
            lines: [
              { productId: "prod_test", name: "Producto de prueba", unitPrice: 100, quantity: 1 },
            ],
          },
          customer: { name: "Cliente de prueba", whatsapp: "+50588887778" },
          payments: [{ method: "cash", amount: 100, currency: "NIO" }],
          idempotencyKey: "caja-cerrada-en-el-medio",
        },
        saleDeps,
      ),
    ).rejects.toThrow(/se cerró/i);

    // Ni el cobro ni el pedido: la venta entera se deshace (la transacción de AUD-004) y la plata no queda
    // firmada por un turno cerrado que ningún arqueo va a volver a leer.
    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);

    const shift = await prisma.shift.findUnique({ where: { id: SHIFT_ID } });

    expect(shift?.status).toBe("closed");
    expect(Number(shift?.expectedAmount)).toBe(0);
  });

  it("un cierre que arranca con la venta EN CURSO espera y cuenta esa plata", async () => {
    const prisma = getPrismaClient();

    // El otro orden, el que se rompía sin el lock: la venta ya está adentro de su transacción (con el turno
    // bloqueado) y el cierre arranca en el medio. Tiene que **esperar** a que la venta commitee y recién ahí
    // leer los cobros; si leyera antes, el arqueo firmado diría 0 con la plata ya en el cajón.
    const production = await createProductionPosSaleDependencies();
    const shiftDeps = await closeDeps();

    /**
     * El cierre que arranca en el medio. Se resuelve antes de que la venta commitee (mientras el lock está
     * tomado), así que el `await` de abajo espera a que la transacción de la venta termine.
     */
    let resolverCierre: (() => void) | null = null;
    const cierreArrancado = new Promise<void>((resolve) => {
      resolverCierre = resolve;
    });
    let cierre: ReturnType<typeof closeShift> | null = null;

    const saleDeps = {
      ...production,
      runInSaleTransaction: <T,>(work: (scope: PosSaleTransactionScope) => Promise<T>) =>
        production.runInSaleTransaction(async (scope) => {
          const result = await work(scope);

          // Con el turno ya bloqueado por la venta, arranca el cierre: queda esperando el lock.
          cierre = closeShift({ shiftId: SHIFT_ID, closingAmount: 100 }, shiftDeps);
          resolverCierre?.();
          await new Promise((resolve) => setTimeout(resolve, 150));

          return result;
        }),
    };

    const sale = await registerPosSale(
      {
        draft: {
          locationId: "loc_test",
          lines: [{ productId: "prod_test", name: "Producto de prueba", unitPrice: 100, quantity: 1 }],
        },
        customer: { name: "Cliente de prueba", whatsapp: "+50588887779" },
        payments: [{ method: "cash", amount: 100, currency: "NIO" }],
        idempotencyKey: "venta-en-curso-al-cerrar",
      },
      saleDeps,
    );

    // El cierre ya arrancó (adentro de la transacción de la venta): recién ahora puede terminar.
    await cierreArrancado;

    const cierreCerrado = await (cierre as unknown as ReturnType<typeof closeShift>);

    expect(sale.payments).toHaveLength(1);
    expect(
      cierreCerrado.data?.expectedAmount,
      "el arqueo firmó 0 con la plata de la venta en el cajón",
    ).toBe(100);
    expect(cierreCerrado.data?.cashSalesAmount).toBe(100);
    expect(cierreCerrado.data?.difference).toBe(0);

    const payment = await prisma.payment.findFirst();

    expect(payment?.shiftId).toBe(SHIFT_ID);
  });
});
