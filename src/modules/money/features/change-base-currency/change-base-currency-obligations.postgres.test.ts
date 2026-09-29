import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { PrismaBusinessCurrencySettingsRepository } from "@/modules/money/adapters/prisma-business-currency-settings-repository";
import { PrismaCurrencyRepository } from "@/modules/money/adapters/prisma-currency-repository";
import { PrismaMoneyObligationGuard } from "@/modules/money/adapters/prisma-money-obligation-guard";
import { changeBaseCurrency } from "@/modules/money/features/change-base-currency/change-base-currency";

import { closeDatabase, resetDatabase } from "@/shared/testing/postgres";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`D-023`, `A-83`) — **el cambio de moneda base es una
 * operación de período cerrado, contra PostgreSQL real**.
 *
 * La guarda cuenta obligaciones vivas: turnos con la caja abierta y pedidos que todavía deben plata. Lo que
 * se mide acá no es la aritmética —eso es dominio puro y tiene su suite— sino que la consulta **ve lo que hay
 * en la base**: un doble en memoria no puede demostrar que el `where` de Prisma excluya lo que tiene que
 * excluir (un pedido cancelado, un cobro anulado, un turno ya cerrado).
 *
 * Si el `where` se equivoca, el cambio de base queda bloqueado por un pedido que ya no le debe nada a nadie
 * —o peor, permitido con deuda viva— y ningún test de dominio lo detecta.
 */

const ACTOR = "user_base_currency";

async function seed(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.adminUser.create({
    data: {
      id: ACTOR,
      name: "Dueña de prueba",
      email: "owner@base.test.local",
      passwordHash: "no-es-un-hash-real",
      role: "owner",
    },
  });

  await prisma.location.create({
    data: { id: "loc_base", name: "Local de prueba", slug: "local-base", businessHours: [] },
  });

  await prisma.currency.createMany({
    data: [
      { code: "NIO", name: "Córdoba", symbol: "C$", isKnown: true },
      { code: "USD", name: "Dólar", symbol: "US$", isKnown: true },
    ],
  });

  await prisma.businessCurrencySettings.create({
    data: { id: "default", baseCurrencyCode: "NIO", locale: "es-NI" },
  });
}

/** Un pedido con su estado y su total; los cobros se agregan aparte. */
async function order(input: {
  id: string;
  status: string;
  total: number;
  charged?: number;
  voided?: boolean;
}): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.order.create({
    data: {
      id: input.id,
      orderNumber: `P-${input.id}`,
      type: "pickup",
      status: input.status as never,
      customerName: "Cliente de prueba",
      customerWhatsapp: "+50588887777",
      locationId: "loc_base",
      subtotal: input.total,
      total: input.total,
      currencyCode: "NIO",
    },
  });

  if (input.charged !== undefined) {
    await prisma.payment.create({
      data: {
        id: `pay_${input.id}`,
        orderId: input.id,
        method: "cash",
        amount: input.charged,
        currency: "NIO",
        baseCurrencyCode: "NIO",
        exchangeRate: 1,
        baseAmount: input.charged,
        methodKind: "cash",
        ...(input.voided ? { voidedAt: new Date(), voidReason: "prueba" } : {}),
      },
    });
  }
}

function dependencies() {
  return {
    currencyRepository: new PrismaCurrencyRepository(),
    settingsRepository: new PrismaBusinessCurrencySettingsRepository(),
    obligationGuard: new PrismaMoneyObligationGuard(),
    actorUserId: ACTOR,
    now: () => new Date("2026-09-30T12:00:00.000Z"),
  };
}

describe("D-023 · el cambio de moneda base con obligaciones vivas (PostgreSQL real)", () => {
  beforeEach(async () => {
    await resetDatabase();
    await seed();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it("con la caja abierta el cambio se rechaza y la base no se mueve", async () => {
    const prisma = getPrismaClient();

    await prisma.shift.create({
      data: { id: "shift_open", locationId: "loc_base", userId: ACTOR, status: "open", openingAmount: 0 },
    });

    await expect(changeBaseCurrency({ code: "USD" }, dependencies())).rejects.toMatchObject({
      status: 409,
    });

    const saved = await prisma.businessCurrencySettings.findUniqueOrThrow({
      where: { id: "default" },
    });

    expect(saved.baseCurrencyCode).toBe("NIO");
  });

  it("con un pedido que todavía debe plata el cambio se rechaza", async () => {
    await order({ id: "ord_pendiente", status: "ready_for_pickup", total: 500 });

    await expect(changeBaseCurrency({ code: "USD" }, dependencies())).rejects.toMatchObject({
      status: 409,
    });
  });

  it("un pedido cobrado a medias también bloquea: su saldo está expresado en la base vieja", async () => {
    await order({ id: "ord_parcial", status: "ready_for_pickup", total: 500, charged: 200 });

    await expect(changeBaseCurrency({ code: "USD" }, dependencies())).rejects.toMatchObject({
      status: 409,
    });
  });

  it("un pedido cobrado entero no bloquea", async () => {
    await order({ id: "ord_cobrado", status: "ready_for_pickup", total: 500, charged: 500 });

    const result = await changeBaseCurrency({ code: "USD" }, dependencies());

    expect(result.data.baseCurrencyCode).toBe("USD");
  });

  it("un pedido cancelado o terminado no bloquea, aunque no tenga cobros", async () => {
    await order({ id: "ord_cancelado", status: "cancelled", total: 500 });
    await order({ id: "ord_entregado", status: "delivered", total: 300 });

    const result = await changeBaseCurrency({ code: "USD" }, dependencies());

    expect(result.data.baseCurrencyCode).toBe("USD");
  });

  it("un cobro anulado no cuenta como plata cobrada", async () => {
    // El cobro existe pero está anulado: el pedido sigue debiendo y el cambio tiene que bloquearse.
    await order({ id: "ord_anulado", status: "ready_for_pickup", total: 500, charged: 500, voided: true });

    await expect(changeBaseCurrency({ code: "USD" }, dependencies())).rejects.toMatchObject({
      status: 409,
    });
  });

  it("un turno ya cerrado no bloquea", async () => {
    const prisma = getPrismaClient();

    await prisma.shift.create({
      data: {
        id: "shift_cerrado",
        locationId: "loc_base",
        userId: ACTOR,
        status: "closed",
        openingAmount: 0,
        closedAt: new Date("2026-09-29T20:00:00.000Z"),
      },
    });

    const result = await changeBaseCurrency({ code: "USD" }, dependencies());

    expect(result.data.baseCurrencyCode).toBe("USD");
  });
});
