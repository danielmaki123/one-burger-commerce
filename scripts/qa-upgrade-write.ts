/**
 * Comprueba que una base **migrada desde el esquema viejo CON datos** acepta la escritura nueva.
 *
 * Es la otra mitad de la ruta de upgrade: las migraciones aplican y los hechos legacy quedan intactos
 * (`scripts/qa-upgrade-post.sql`), pero además el esquema migrado tiene que dejar escribir un **cobro con su
 * snapshot** y su **clave de idempotencia** —lo que `D-020` y `A-71` exigen hacia adelante—, rechazar la
 * clave repetida por el índice único parcial, y seguir dejando **anular** un cobro legacy.
 *
 * Se corre con `DATABASE_URL` apuntando a una base **local**: es QA, no un test. Los `*.postgres.test.ts`
 * cubren la atomicidad y la concurrencia; esto cubre la **compatibilidad del esquema migrado**.
 */
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "../src/infrastructure/database/prisma";

async function main() {
  const prisma = getPrismaClient();

  // Un cobro NUEVO: los cinco campos de `D-020`, más el medio configurable y su tipo canónico.
  const fresh = await prisma.payment.create({
    data: {
      id: "pay_new_after_upgrade",
      orderId: "ord_1",
      method: "card",
      amount: 10,
      currency: "USD",
      baseCurrencyCode: "NIO",
      exchangeRate: 36.5,
      baseAmount: 365,
      methodKind: "card",
      idempotencyKey: "key_after_upgrade",
    },
  });

  console.log(
    "cobro nuevo:",
    JSON.stringify({
      currency: fresh.currency,
      baseAmount: fresh.baseAmount?.toString(),
      idempotencyKey: fresh.idempotencyKey,
    }),
  );

  // El índice único **parcial**: la misma clave no puede entrar dos veces.
  let rechazado = false;
  try {
    await prisma.payment.create({
      data: {
        id: "pay_duplicado",
        orderId: "ord_1",
        method: "card",
        amount: 10,
        currency: "USD",
        idempotencyKey: "key_after_upgrade",
      },
    });
  } catch {
    rechazado = true;
  }

  console.log("clave duplicada rechazada por la base:", rechazado);

  // Un cobro LEGACY se sigue pudiendo anular (soft delete) con las columnas nuevas en `null`.
  const voided = await prisma.payment.update({
    where: { id: "pay_legacy_usd" },
    data: { voidedAt: new Date(), voidedByUserId: "u1", voidReason: "Prueba de compatibilidad" },
  });

  console.log(
    "legacy anulado sin tocar su snapshot:",
    voided.voidedAt !== null && voided.baseAmount === null,
  );

  /**
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-88`, `A-89`, `A-90`) — **las tres columnas nuevas se
   * pueden escribir** en la base migrada, y su valor queda como se pidió: un pedido con su moneda congelada,
   * un cierre con su base y su mapa de tasas, y una config de conteo con la lista de monedas contables.
   *
   * Es la mitad que `qa-upgrade-post.sql` no puede ver: que el esquema migrado **acepte** lo nuevo, no sólo que
   * deje intacto lo viejo.
   */
  const order = await prisma.order.update({
    where: { id: "ord_1" },
    data: { currencyCode: "NIO" },
    select: { currencyCode: true },
  });

  const shift = await prisma.shift.update({
    where: { id: "sh_1" },
    data: { baseCurrencyCode: "NIO", exchangeRatesByCurrency: { USD: 36.5 } },
    select: { baseCurrencyCode: true, exchangeRatesByCurrency: true },
  });

  const cashConfig = await prisma.locationCashConfig.update({
    where: { id: "cc_1" },
    data: { countedCurrencyCodes: ["NIO", "USD", "EUR"] },
    select: { countedCurrencyCodes: true },
  });

  console.log(
    "columnas nuevas escribibles:",
    JSON.stringify({
      orderCurrency: order.currencyCode,
      shiftBase: shift.baseCurrencyCode,
      shiftRates: shift.exchangeRatesByCurrency,
      counted: cashConfig.countedCurrencyCodes,
    }),
  );

  /**
   * `A-88` — **una moneda que no es `NIO` ni `USD`**, sin ninguna columna nueva: es la prueba de que la lista
   * es estructura y no un booleano del dólar que se quedó corto.
   */
  console.log("tres monedas contables sin columna nueva:", cashConfig.countedCurrencyCodes.length === 3);

  // Se limpia lo que agregó esta prueba: la base de QA no queda con datos de la verificación.
  await prisma.payment.delete({ where: { id: "pay_new_after_upgrade" } });
  await prisma.payment.update({
    where: { id: "pay_legacy_usd" },
    data: { voidedAt: null, voidedByUserId: null, voidReason: null },
  });
  await prisma.order.update({ where: { id: "ord_1" }, data: { currencyCode: null } });
  await prisma.shift.update({
    where: { id: "sh_1" },
    data: { baseCurrencyCode: null, exchangeRatesByCurrency: Prisma.DbNull },
  });
  await prisma.locationCashConfig.update({
    where: { id: "cc_1" },
    data: { countedCurrencyCodes: ["NIO", "USD"] },
  });

  await prisma.$disconnect();
}

void main();
