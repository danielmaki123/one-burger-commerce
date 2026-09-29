import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { createProductionPosSaleDependencies } from "@/modules/pos/adapters/production-pos-sale";
import { registerPosSale } from "@/modules/pos/features/register-pos-sale/register-pos-sale";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`, `D-020`, `D-024`) — **el snapshot del cobro del
 * POS, contra PostgreSQL real**.
 *
 * El hueco: la venta del mostrador era el **único** camino productivo que creaba `Payment` sin pasar por la
 * construcción canónica del snapshot. El cobro quedaba con `baseCurrencyCode`, `exchangeRate`, `baseAmount`
 * y `methodKind` en `null`, así que el hecho no se podía explicar después sin volver a la configuración de
 * ese día (ley 7) y el saldo del pedido se medía contra una suma cruda de monedas distintas.
 *
 * Se prueba contra la base de verdad y con las dependencias de producción **enteras** (`getMoneySettings`,
 * las tasas, el catálogo de monedas): un doble en memoria podría aceptar el snapshot y no escribirlo, que es
 * exactamente el modo de falla que este test tiene que detectar.
 *
 * Las tres cosas que se miden:
 *
 * 1. un cobro en la moneda base congela la **igualdad** (tasa 1, equivalente igual al monto);
 * 2. un cobro en otra moneda congela **su** tasa, la que estaba vigente en Finanzas al momento del cobro;
 * 3. el reintento de la venta suma el equivalente **persistido** y no vuelve a convertir con la tasa de hoy:
 *    se registra una tasa nueva entre el primer intento y el reintento, y el número no se mueve.
 */

const IDEMPOTENCY_KEY = "sale-snapshot-1";

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: "user_cashier_test",
      name: "Cajera de prueba",
      email: "cajera@example.test",
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

function saleInput(payments: Array<{ method: "cash" | "card"; amount: number; currency: string }>) {
  return {
    draft: {
      locationId: "loc_test",
      lines: [{ productId: "prod_test", name: "Producto de prueba", unitPrice: 100, quantity: 1 }],
    },
    customer: { name: "Cliente de prueba", whatsapp: "+50588887777" },
    payments,
    idempotencyKey: IDEMPOTENCY_KEY,
  };
}

/** Deja el catálogo y la base del negocio como los deja la primera lectura de `money`. */
async function configureMoney(baseCurrencyCode = "NIO"): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.currency.upsert({
    where: { code: baseCurrencyCode },
    create: { code: baseCurrencyCode, name: baseCurrencyCode, symbol: baseCurrencyCode, isKnown: true },
    update: {},
  });
  await prisma.currency.upsert({
    where: { code: "USD" },
    create: { code: "USD", name: "Dólar", symbol: "US$", isKnown: true },
    update: {},
  });
  await prisma.businessCurrencySettings.upsert({
    where: { id: "default" },
    create: { id: "default", baseCurrencyCode, locale: "es-NI" },
    update: { baseCurrencyCode, locale: "es-NI" },
  });
}

async function registerUsdRate(rate: number, effectiveFrom: string): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.exchangeRate.updateMany({
    where: { fromCurrencyCode: "USD", toCurrencyCode: "NIO", effectiveTo: null },
    data: { effectiveTo: effectiveFrom },
  });
  await prisma.exchangeRate.create({
    data: {
      fromCurrencyCode: "USD",
      toCurrencyCode: "NIO",
      rate,
      effectiveFrom,
    },
  });
}

describe("A-81 · el POS congela el snapshot del cobro (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
    await configureMoney();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("un cobro en la moneda base queda con la igualdad congelada", async () => {
    const prisma = getPrismaClient();

    await registerPosSale(
      saleInput([{ method: "cash", amount: 100, currency: "NIO" }]),
      await createProductionPosSaleDependencies(),
    );

    const payment = await prisma.payment.findFirstOrThrow();

    expect(payment.baseCurrencyCode).toBe("NIO");
    expect(Number(payment.exchangeRate)).toBe(1);
    expect(Number(payment.baseAmount)).toBe(100);
    expect(payment.methodKind).toBe("cash");
  });

  it("un cobro en otra moneda queda con la tasa vigente y su equivalente", async () => {
    const prisma = getPrismaClient();
    await registerUsdRate(36.5, "2026-09-01T00:00:00.000Z");

    // 3 × 36.5 = 109.50: la venta de 100 entra con vuelto.
    await registerPosSale(
      saleInput([{ method: "cash", amount: 3, currency: "USD" }]),
      await createProductionPosSaleDependencies(),
    );

    const payment = await prisma.payment.findFirstOrThrow();

    expect(payment.currency).toBe("USD");
    expect(payment.baseCurrencyCode).toBe("NIO");
    expect(Number(payment.exchangeRate)).toBe(36.5);
    expect(Number(payment.baseAmount)).toBe(109.5);
    expect(payment.methodKind).toBe("cash");
  });

  it("el reintento suma el equivalente persistido, no la tasa de hoy", async () => {
    const prisma = getPrismaClient();
    await registerUsdRate(30, "2026-09-01T00:00:00.000Z");

    const first = await registerPosSale(
      saleInput([{ method: "cash", amount: 20, currency: "USD" }]),
      await createProductionPosSaleDependencies(),
    );

    // 20 × 30 = 600. La tasa se mueve **después** del cobro: el hecho ya está firmado y no se reinterpreta.
    expect(first.paidInBusinessCurrency).toBe(600);
    await registerUsdRate(50, "2026-09-15T00:00:00.000Z");

    const retry = await registerPosSale(
      saleInput([{ method: "cash", amount: 20, currency: "USD" }]),
      await createProductionPosSaleDependencies(),
    );

    expect(retry.reused).toBe(true);
    expect(retry.paidInBusinessCurrency).toBe(600);

    const payment = await prisma.payment.findFirstOrThrow();
    expect(Number(payment.exchangeRate)).toBe(30);
    expect(Number(payment.baseAmount)).toBe(600);
  });

  it("un cobro en una moneda sin tasa vigente no deja ni el pedido", async () => {
    const prisma = getPrismaClient();

    await expect(
      registerPosSale(
        saleInput([{ method: "cash", amount: 10, currency: "USD" }]),
        await createProductionPosSaleDependencies(),
      ),
    ).rejects.toThrow(/tasa vigente/i);

    expect(await prisma.payment.count()).toBe(0);
    expect(await prisma.order.count()).toBe(0);
  });
});
