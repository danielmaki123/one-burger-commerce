import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { runInOrderPaymentTransaction } from "@/app/api/admin/orders/[id]/payment/payment-composition";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { closeShift } from "@/modules/orders/features/shift/close-shift";
import { registerOrderPayment } from "@/modules/orders/features/register-order-payment/register-order-payment";
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

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — la configuración monetaria que el cierre lee:
 * la moneda base en `BusinessCurrencySettings` y la tasa vigente en `ExchangeRate`. El arnés vacía la base,
 * así que las filas se crean acá.
 */
async function configureCloseMoney(input: { base?: string; usdRate?: number } = {}): Promise<void> {
  const prisma = getPrismaClient();
  const base = input.base ?? "NIO";
  const usdRate = input.usdRate ?? 36.5;

  await prisma.currency.upsert({
    where: { code: base },
    create: { code: base, name: base, symbol: base, isKnown: true },
    update: {},
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    create: { code: "USD", name: "Dólar", symbol: "US$", isKnown: true },
    update: {},
  });
  await prisma.businessCurrencySettings.upsert({
    where: { id: "default" },
    create: { id: "default", baseCurrencyCode: base, locale: "es-NI" },
    update: { baseCurrencyCode: base, locale: "es-NI" },
  });
  await prisma.exchangeRate.updateMany({
    where: { fromCurrencyCode: "USD", toCurrencyCode: base, effectiveTo: null },
    data: { effectiveTo: "2026-09-01T00:00:00.000Z" },
  });
  await prisma.exchangeRate.create({
    data: {
      fromCurrencyCode: "USD",
      toCurrencyCode: base,
      rate: usdRate,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
    },
  });
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

    // Cuál de los dos gana depende del orden en que el pool los atienda (medido: gana el primero ~70% de las
    // veces), así que se afirma la **invariante**: lo persistido es lo del ganador, no la del primero que se
    // emitió (afirmar eso era un test que fallaba ~30% de las veces con la invariante intacta).
    const ganador = ganadores[0].data;

    expect(ganador?.id).toBe(SHIFT_ID);

    const shift = await prisma.shift.findUnique({ where: { id: SHIFT_ID } });

    expect(shift?.status).toBe("closed");
    expect(Number(shift?.closingAmount)).toBe(ganador?.closingAmount);
    expect(Number(shift?.expectedAmount)).toBe(ganador?.expectedAmount);

    // El detalle del ganador, una sola vez: el perdedor no agregó su conteo.
    const counts = await prisma.shiftCashCount.findMany({ where: { kind: "closing" } });

    expect(counts).toHaveLength(1);
    // El conteo del ganador: cada billete de C$100 vale por 1 en el conteo (100 → 1, 999 → 9).
    expect(counts[0].quantity).toBe((ganador?.closingAmount ?? 0) / 100);
  });

  it("el arqueo incluye los movimientos y las devoluciones del turno (como el corte X)", async () => {
    const prisma = getPrismaClient();

    // TASK-AUD-005 — el cierre de producción no cableaba estos dos repositorios, así que firmaba un esperado
    // **sin** retiros ni devoluciones: el mismo turno daba un número distinto en el corte X y en el papel que
    // se firma. Acá se cobra 100 en efectivo, se retiran 40 del cajón y se devuelven 10: el esperado es 50.
    await sellOneHundred();
    await prisma.cashMovement.create({
      data: {
        shiftId: SHIFT_ID,
        kind: "withdrawal",
        category: "supplier",
        amount: 40,
        currency: "NIO",
        reason: "Pago al proveedor",
        userId: "user_cashier_test",
      },
    });
    // La devolución va contra el cobro de la venta (su `paymentId` es obligatorio) y **aprobada**: solo las
    // aprobadas salen del cajón.
    const payment = await prisma.payment.findFirstOrThrow();

    await prisma.refund.create({
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        shiftId: SHIFT_ID,
        kind: "full",
        method: "cash",
        amount: 10,
        currency: "NIO",
        status: "approved",
        reason: "Cliente devolvió el producto",
        requestedByUserId: "user_cashier_test",
        approvedByUserId: "user_cashier_test",
        approvedAt: new Date(),
      },
    });

    const cierre = await closeShift({ shiftId: SHIFT_ID, closingAmount: 50 }, await closeDeps());

    expect(cierre.data?.expectedAmount).toBe(50);
    // Las dos cosas que salieron del cajón van con signo negativo (el neto que el arqueo ya sabía calcular
    // cuando los repositorios llegaban cableados): es lo que se le resta al esperado.
    expect(cierre.data?.cashMovementsAmount).toBe(-40);
    expect(cierre.data?.refundsAmount).toBe(-10);
    expect(cierre.data?.difference).toBe(0);
  });

  it("un turno reabierto y vuelto a cerrar reemplaza el conteo, no lo acumula", async () => {
    const prisma = getPrismaClient();

    // El conteo es el detalle que justifica el total firmado: si se acumulara, el papel diría 9 billetes
    // contados sobre un total que declara 1. Los cierres de banco ya se reemplazaban; los conteos no.
    await closeShift(
      {
        shiftId: SHIFT_ID,
        closingAmount: 100,
        closingCounts: [{ currency: "NIO", denomination: 100, quantity: 1 }],
      },
      await closeDeps(),
    );
    await prisma.shift.updateMany({ where: { id: SHIFT_ID }, data: { status: "open" } });

    await closeShift(
      {
        shiftId: SHIFT_ID,
        closingAmount: 500,
        closingCounts: [{ currency: "NIO", denomination: 100, quantity: 5 }],
      },
      await closeDeps(),
    );

    const counts = await prisma.shiftCashCount.findMany({ where: { kind: "closing" } });

    expect(counts).toHaveLength(1);
    expect(counts[0].quantity).toBe(5);
    expect(Number((await prisma.shift.findUnique({ where: { id: SHIFT_ID } }))?.closingAmount)).toBe(500);
  });

  it("un cobro de un pedido que ya existe también se rechaza si el turno se cerró", async () => {
    const prisma = getPrismaClient();

    // El **segundo** camino que le firma el turno a un `Payment` (`POST /api/admin/orders/[id]/payment`).
    // Se usa la composición **real** del runner (`runInOrderPaymentTransaction`), no una copia del test.
    const order = await prisma.order.create({
      data: {
        orderNumber: "P-COBRO1",
        type: "pickup",
        status: "ready",
        customerName: "Cliente de prueba",
        customerWhatsapp: "+50588887777",
        locationId: "loc_test",
        subtotal: 100,
        total: 100,
      },
    });

    await closeShift({ shiftId: SHIFT_ID, closingAmount: 0 }, await closeDeps());

    await expect(
      registerOrderPayment(
        { orderId: order.id, method: "cash", amount: 100, currency: "NIO", idempotencyKey: `k_${Math.random().toString(36).slice(2)}` },
        {
          orderRepository: new PrismaOrderRepository(),
          paymentRepository: new PrismaPaymentRepository(),
          findOpenShift: async () => ({ id: SHIFT_ID }),
          runInOrderPaymentTransaction,
          baseCurrencyCode: "NIO",
          rates: {},
      paymentMethodKind: "cash",
        },
      ),
    ).rejects.toThrow(/se cerró/i);

    expect(await prisma.payment.count()).toBe(0);
  });

  it("un cobro de un pedido que ya existe, con la caja abierta, entra al arqueo del cierre", async () => {
    const prisma = getPrismaClient();

    const order = await prisma.order.create({
      data: {
        orderNumber: "P-COBRO2",
        type: "pickup",
        status: "ready",
        customerName: "Cliente de prueba",
        customerWhatsapp: "+50588887778",
        locationId: "loc_test",
        subtotal: 100,
        total: 100,
      },
    });
    const shiftDeps = await closeDeps();

    /**
     * El cierre que arranca **adentro** de la transacción del cobro, con el turno ya bloqueado: tiene que
     * esperar a que el cobro commitee y recién ahí leer su arqueo.
     */
    let cierre: ReturnType<typeof closeShift> | null = null;

    await registerOrderPayment(
      { orderId: order.id, method: "cash", amount: 100, currency: "NIO", idempotencyKey: `k_${Math.random().toString(36).slice(2)}` },
      {
        orderRepository: new PrismaOrderRepository(),
        paymentRepository: new PrismaPaymentRepository(),
        findOpenShift: async () => ({ id: SHIFT_ID }),
        runInOrderPaymentTransaction: <T,>(
          work: Parameters<typeof runInOrderPaymentTransaction<T>>[0],
        ) =>
          runInOrderPaymentTransaction(async (scope) => {
            const result = await work(scope);

            cierre = closeShift({ shiftId: SHIFT_ID, closingAmount: 100 }, shiftDeps);
            await new Promise((resolve) => setTimeout(resolve, 150));

            return result;
          }),
        baseCurrencyCode: "NIO",
        rates: {},
      paymentMethodKind: "cash",
      },
    );

    const cierreCerrado = await (cierre as unknown as ReturnType<typeof closeShift>);

    expect((await prisma.payment.findFirst())?.shiftId).toBe(SHIFT_ID);
    expect(
      cierreCerrado.data?.expectedAmount,
      "el arqueo firmó 0 con el cobro de este camino ya en el cajón",
    ).toBe(100);
    expect(cierreCerrado.data?.cashSalesAmount).toBe(100);
    expect(cierreCerrado.data?.difference).toBe(0);
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

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-72`, `D-020`) — **el cierre congela la tasa que lo produjo**.
   *
   * El arqueo guarda su esperado **en ambas monedas** desde siempre (`expectedByCurrency`), pero no la tasa
   * con la que convirtió: sin ella, el `expectedByCurrency` no alcanza para demostrar la equivalencia de un
   * cobro legacy —`US$10` sólo se explica contra los `C$365` del esperado si se sabe a qué tasa se hizo—, que
   * es el único dato persistido que `D-020` acepta como prueba. Es la tercera de las tres simetrías que el
   * brief pide cerrar **hacia adelante**.
   *
   * La columna existía desde la migración y **nadie la escribía**: el snapshot estaba a medias. Por eso el
   * test mira la **base** y no sólo la respuesta del caso de uso.
   */
  it("al cerrar congela la moneda base y la tasa de cada moneda contable", async () => {
    const prisma = getPrismaClient();

    /**
     * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`, `A-90`) — la tasa que el cierre firma sale de
     * **`money`**, no de `BusinessSettings.usdExchangeRate`: la autoridad es el catálogo de monedas con su
     * historial de tasas, que es lo que `/admin/finance` escribe. Antes el cierre leía la configuración
     * vieja, así que un cambio de tasa en Finanzas no llegaba al arqueo.
     */
    await configureCloseMoney();

    const cierre = await closeShift({ shiftId: SHIFT_ID, closingAmount: 0 }, await closeDeps());

    // La forma **general**: con qué moneda base y con qué tasa por moneda se firmó.
    expect(cierre.data?.baseCurrencyCode, "el cierre no firmó su moneda base").toBe("NIO");
    expect(cierre.data?.exchangeRatesByCurrency).toEqual({ USD: 36.5 });

    // Y queda **persistida**: es lo que hace que un cierre viejo pueda explicar la equivalencia.
    const persistido = await prisma.shift.findUnique({ where: { id: SHIFT_ID } });

    expect(persistido?.baseCurrencyCode).toBe("NIO");
    expect(persistido?.exchangeRatesByCurrency).toEqual({ USD: 36.5 });
    // El escalar legacy se sigue firmando para la compatibilidad del caso de un solo par de monedas.
    expect(Number(persistido?.exchangeRate)).toBe(36.5);
  });
});
