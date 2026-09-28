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

  // Se limpia lo que agregó esta prueba: la base de QA no queda con datos de la verificación.
  await prisma.payment.delete({ where: { id: "pay_new_after_upgrade" } });
  await prisma.payment.update({
    where: { id: "pay_legacy_usd" },
    data: { voidedAt: null, voidedByUserId: null, voidReason: null },
  });

  await prisma.$disconnect();
}

void main();
